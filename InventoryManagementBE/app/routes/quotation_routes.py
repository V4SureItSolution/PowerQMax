# app/routes/quotation_routes.py
from flask import Blueprint, request, jsonify
from app.models.quotation import Quotation, QuotationItem
from app.models.product import Product
from app import db
from sqlalchemy import or_
from datetime import datetime, timedelta

quotation_bp = Blueprint('quotation_bp', __name__)

# ------------------ SEARCH PRODUCTS FOR QUOTATION ------------------
@quotation_bp.route('/billing/search-products', methods=['GET'])
def search_products():
    """Search products by name, model, or type for quotations"""
    try:
        query = request.args.get('q', '')
        
        if not query or len(query) < 2:
            return jsonify([]), 200
        
        # Search in name, model, and type fields
        products = Product.query.filter(
            or_(
                Product.name.ilike(f'%{query}%'),
                Product.model.ilike(f'%{query}%'),
                Product.type.ilike(f'%{query}%')
            )
        ).limit(20).all()
        
        # Return minimal product data needed for quotation
        result = []
        for product in products:
            result.append({
                'id': product.id,
                'name': product.name,
                'model': product.model or '',
                'type': product.type or '',
                'sellPrice': product.sell_price,
                'price': product.sell_price,
                'mrp': product.sell_price,
                'hsnCode': getattr(product, 'hsn_code', ''),
                'gst': getattr(product, 'gst_rate', 0),
                'stock': product.quantity,
                'quantity': product.quantity
            })
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------ CREATE QUOTATION ------------------
@quotation_bp.route('/quotation', methods=['POST'])
def create_quotation():
    """Create a new quotation"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('customerName'):
            return jsonify({'error': 'Customer name is required'}), 400
        
        if not data.get('customerPhone'):
            return jsonify({'error': 'Customer phone is required'}), 400
        
        if not data.get('items') or len(data['items']) == 0:
            return jsonify({'error': 'At least one item is required'}), 400
        
        # Create quotation
        quotation = Quotation()
        quotation.quotation_number = generate_quotation_number()
        quotation.customer_name = data['customerName']
        quotation.attn = data.get('attn', '')
        quotation.customer_phone = data['customerPhone']
        quotation.customer_email = data.get('customerEmail', '')
        quotation.customer_address = data.get('customerAddress', '')
        quotation.customer_gstin = data.get('customerGstin', '')
        quotation.project = data.get('project', '')
        quotation.prepared_by = data.get('preparedBy', data.get('prepared_by', ''))
        
        # Parse dates
        if data.get('quotationDate'):
            quotation.quotation_date = datetime.strptime(data['quotationDate'], '%Y-%m-%d').date()
        else:
            quotation.quotation_date = datetime.now().date()
            
        if data.get('validUntil'):
            quotation.valid_until = datetime.strptime(data['validUntil'], '%Y-%m-%d').date()
        else:
            # Default validity: 30 days
            quotation.valid_until = datetime.now().date() + timedelta(days=30)
        
        # Discount details
        quotation.discount_type = data.get('discountType', 'fixed')
        quotation.discount_rate = float(data.get('discountRate', 0))
        quotation.discount = data.get('discount', 0)
        
        # Notes
        quotation.notes = data.get('notes', '')
        
        # Status
        quotation.status = 'draft'
        
        db.session.add(quotation)
        db.session.flush()  # Get quotation ID
        
        # Add items (supporting manual items and changeable sell prices)
        items_total = 0
        for item_data in data.get('items', []):
            product_id = item_data.get('productId') or item_data.get('product_id')
            product = None
            if product_id:
                try:
                    product = Product.query.get(product_id)
                except:
                    product = None
            
            p_name = item_data.get('productName') or item_data.get('name') or (product.name if product else 'Item')
            p_model = item_data.get('productModel') or item_data.get('model') or (product.model if product else '')
            price = float(item_data.get('price', getattr(product, 'sell_price', 0.0) if product else 0.0))
            quantity = int(item_data.get('quantity', 1))
            unit = item_data.get('unit', 'nos') or 'nos'
            gst = float(item_data.get('gst', 0.0))
            
            item = QuotationItem()
            item.quotation_id = quotation.id
            item.product_id = product.id if product else None
            item.product_name = p_name
            item.product_model = p_model
            item.price = price
            item.quantity = quantity
            item.unit = unit
            item.gst = gst
            item.calculate_total()
            
            items_total += item.total
            db.session.add(item)
        
        # Calculate totals manually (avoid calculate_totals() which reads self.items before commit)
        quotation.subtotal = items_total
        if quotation.discount_type == 'percentage':
            quotation.discount = (items_total * quotation.discount_rate) / 100
        else:
            quotation.discount = min(quotation.discount_rate, items_total)
        quotation.total = items_total - quotation.discount
        
        db.session.commit()
        
        return jsonify({
            'message': 'Quotation created successfully',
            'quotationNumber': quotation.quotation_number,
            'quotation': quotation.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ------------------ GET ALL QUOTATIONS ------------------
@quotation_bp.route('/quotation', methods=['GET'])
def get_quotations():
    """Get all quotations with pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status = request.args.get('status')
        approval_status = request.args.get('approval_status')
        
        query = Quotation.query
        
        if status:
            query = query.filter_by(status=status)
        if approval_status:
            query = query.filter_by(approval_status=approval_status)
        
        # Order by created date descending
        query = query.order_by(Quotation.created_at.desc())
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'items': [q.to_dict() for q in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ------------------ GET SINGLE QUOTATION ------------------
@quotation_bp.route('/quotation/<int:id>', methods=['GET'])
def get_quotation(id):
    """Get a single quotation by ID"""
    try:
        quotation = Quotation.query.get_or_404(id)
        return jsonify(quotation.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------ UPDATE QUOTATION ------------------
@quotation_bp.route('/quotation/<int:id>', methods=['PUT'])
def update_quotation(id):
    """Update a quotation"""
    try:
        quotation = Quotation.query.get_or_404(id)
        
        # Only draft quotations can be updated
        if quotation.status != 'draft':
            return jsonify({'error': 'Only draft quotations can be updated'}), 400
        
        data = request.get_json()
        
        # Update customer details
        if data.get('customerName'):
            quotation.customer_name = data['customerName']
        if 'attn' in data:
            quotation.attn = data['attn']
        if data.get('customerPhone'):
            quotation.customer_phone = data['customerPhone']
        if data.get('customerEmail') is not None:
            quotation.customer_email = data['customerEmail']
        if data.get('customerAddress') is not None:
            quotation.customer_address = data['customerAddress']
        if data.get('customerGstin') is not None:
            quotation.customer_gstin = data['customerGstin']
        if 'project' in data:
            quotation.project = data['project']
        if 'preparedBy' in data or 'prepared_by' in data:
            quotation.prepared_by = data.get('preparedBy', data.get('prepared_by', ''))
        
        # Update dates
        if data.get('quotationDate'):
            quotation.quotation_date = datetime.strptime(data['quotationDate'], '%Y-%m-%d').date()
        if data.get('validUntil'):
            quotation.valid_until = datetime.strptime(data['validUntil'], '%Y-%m-%d').date()
        
        # Update discount
        if data.get('discountType'):
            quotation.discount_type = data['discountType']
        if data.get('discountRate') is not None:
            quotation.discount_rate = float(data['discountRate'])
        if data.get('discount') is not None:
            quotation.discount = float(data['discount'])
        
        # Update notes
        if data.get('notes') is not None:
            quotation.notes = data['notes']
        
        # Update items if provided
        if data.get('items'):
            # Delete existing items
            QuotationItem.query.filter_by(quotation_id=quotation.id).delete()
            
            # Add new items (supporting manual items and changeable sell prices)
            items_total = 0
            for item_data in data['items']:
                product_id = item_data.get('productId') or item_data.get('product_id')
                product = None
                if product_id:
                    try:
                        product = Product.query.get(product_id)
                    except:
                        product = None
                
                p_name = item_data.get('productName') or item_data.get('name') or (product.name if product else 'Item')
                p_model = item_data.get('productModel') or item_data.get('model') or (product.model if product else '')
                price = float(item_data.get('price', getattr(product, 'sell_price', 0.0) if product else 0.0))
                quantity = int(item_data.get('quantity', 1))
                unit = item_data.get('unit', 'nos') or 'nos'
                gst = float(item_data.get('gst', 0.0))
                
                item = QuotationItem()
                item.quotation_id = quotation.id
                item.product_id = product.id if product else None
                item.product_name = p_name
                item.product_model = p_model
                item.price = price
                item.quantity = quantity
                item.unit = unit
                item.gst = gst
                item.calculate_total()
                
                items_total += item.total
                db.session.add(item)
            
            quotation.subtotal = items_total
        
        # Recalculate totals manually
        subtotal = quotation.subtotal or 0
        if quotation.discount_type == 'percentage':
            quotation.discount = (subtotal * quotation.discount_rate) / 100
        else:
            quotation.discount = min(quotation.discount_rate, subtotal)
        quotation.total = subtotal - quotation.discount
        
        db.session.commit()
        
        return jsonify({
            'message': 'Quotation updated successfully',
            'quotation': quotation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ------------------ UPDATE QUOTATION STATUS ------------------
@quotation_bp.route('/quotation/<int:id>/status', methods=['PATCH'])
def update_quotation_status(id):
    """Update quotation status"""
    try:
        quotation = Quotation.query.get_or_404(id)
        data = request.get_json()
        
        new_status = data.get('status')
        valid_statuses = ['draft', 'sent', 'accepted', 'expired', 'cancelled']
        
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        quotation.status = new_status
        db.session.commit()
        
        return jsonify({
            'message': f'Quotation status updated to {new_status}',
            'quotation': quotation.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------ DELETE QUOTATION ------------------
@quotation_bp.route('/quotation/<int:id>', methods=['DELETE'])
def delete_quotation(id):
    """Delete a quotation"""
    try:
        quotation = Quotation.query.get_or_404(id)
        QuotationItem.query.filter_by(quotation_id=id).delete()
        db.session.delete(quotation)
        db.session.commit()
        return jsonify({'message': 'Quotation deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ------------------ GET QUOTATION STATISTICS ------------------
@quotation_bp.route('/quotation/statistics', methods=['GET'])
def get_quotation_statistics():
    """Get quotation statistics"""
    try:
        from sqlalchemy import func
        
        # Total quotations
        total = Quotation.query.count()
        
        # Quotations by status
        status_counts = db.session.query(
            Quotation.status,
            func.count(Quotation.id).label('count')
        ).group_by(Quotation.status).all()
        
        # Total value of accepted quotations
        total_accepted_value = db.session.query(
            func.sum(Quotation.total)
        ).filter(Quotation.status == 'accepted').scalar() or 0
        
        # Expired quotations
        from datetime import date
        expired_count = Quotation.query.filter(
            Quotation.valid_until < date.today(),
            Quotation.status.in_(['draft', 'sent'])
        ).count()
        
        return jsonify({
            'total_quotations': total,
            'total_accepted_value': total_accepted_value,
            'expired_count': expired_count,
            'status_breakdown': [
                {'status': s[0] or 'unknown', 'count': s[1]} for s in status_counts
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------ APPROVE QUOTATION ------------------
@quotation_bp.route('/quotation/<int:id>/approve', methods=['POST', 'PUT'])
def approve_quotation(id):
    """Approve a quotation"""
    try:
        data = request.get_json() or {}
        quotation = Quotation.query.get_or_404(id)
        
        quotation.approval_status = 'approved'
        quotation.status = 'approved'
        quotation.approved_by = data.get('approvedBy', data.get('approved_by', 'Manager'))
        quotation.approved_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Quotation {quotation.quotation_number} approved successfully',
            'quotation': quotation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ------------------ REJECT QUOTATION ------------------
@quotation_bp.route('/quotation/<int:id>/reject', methods=['POST', 'PUT'])
def reject_quotation(id):
    """Reject a quotation with a reason"""
    try:
        data = request.get_json() or {}
        quotation = Quotation.query.get_or_404(id)
        
        quotation.approval_status = 'rejected'
        quotation.status = 'rejected'
        quotation.rejection_reason = data.get('rejectionReason', data.get('rejection_reason', 'Not approved'))
        quotation.approved_by = data.get('approvedBy', data.get('approved_by', 'Manager'))
        quotation.approved_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Quotation {quotation.quotation_number} rejected',
            'quotation': quotation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ------------------ HEALTH CHECK ------------------
@quotation_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'quotation'}), 200


# Helper function to generate quotation number
def generate_quotation_number():
    """Generate a unique quotation number like PQM-QT-0001"""
    total = Quotation.query.count() + 1
    number = f"PQM-QT-{total:04d}"
    while Quotation.query.filter_by(quotation_number=number).first():
        total += 1
        number = f"PQM-QT-{total:04d}"
    return number