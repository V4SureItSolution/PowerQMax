from flask import Blueprint, request, jsonify
from app import db
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, DEFAULT_PO_TERMS, DEFAULT_DELIVER_TO
from app.models.supplier import Supplier
from app.models.product import Product
from datetime import datetime
from sqlalchemy import func
import traceback

purchase_order_bp = Blueprint('purchase_order', __name__)

def generate_po_number():
    """Generate a unique purchase order number in PQM-PO-XXXX format"""
    try:
        count = PurchaseOrder.query.count()
        seq = str(count + 1).zfill(4)
        num = f"PQM-PO-{seq}"
        while PurchaseOrder.query.filter_by(po_number=num).first():
            count += 1
            seq = str(count + 1).zfill(4)
            num = f"PQM-PO-{seq}"
        return num
    except Exception as e:
        print(f"Error generating PO number: {str(e)}")
        return f"PQM-PO-{datetime.now().strftime('%Y%m%d%H%M%S')}"

@purchase_order_bp.route('/purchase-order', methods=['GET'])
def get_purchase_orders():
    """Get all purchase orders with pagination, search and filters"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        supplier_name = request.args.get('supplier_name')
        status = request.args.get('status')
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        search = request.args.get('search')

        query = PurchaseOrder.query

        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (PurchaseOrder.po_number.ilike(search_term)) |
                (PurchaseOrder.supplier_name.ilike(search_term)) |
                (PurchaseOrder.your_quote_ref.ilike(search_term)) |
                (PurchaseOrder.attn.ilike(search_term))
            )

        if supplier_name:
            query = query.filter(PurchaseOrder.supplier_name.ilike(f"%{supplier_name.strip()}%"))

        if status and status.lower() != 'all':
            query = query.filter(PurchaseOrder.status == status.lower())

        if from_date:
            try:
                from_dt = datetime.strptime(from_date, '%Y-%m-%d').date()
                query = query.filter(PurchaseOrder.po_date >= from_dt)
            except ValueError:
                pass

        if to_date:
            try:
                to_dt = datetime.strptime(to_date, '%Y-%m-%d').date()
                query = query.filter(PurchaseOrder.po_date <= to_dt)
            except ValueError:
                pass

        query = query.order_by(PurchaseOrder.created_at.desc())
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        items = [po.to_dict() for po in paginated.items]

        return jsonify({
            'success': True,
            'items': items,
            'total': paginated.total,
            'page': page,
            'per_page': per_page,
            'pages': paginated.pages
        }), 200

    except Exception as e:
        print(f"Error in get_purchase_orders: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order/<int:id>', methods=['GET'])
def get_purchase_order(id):
    """Get single purchase order by ID"""
    try:
        po = PurchaseOrder.query.get(id)
        if not po:
            return jsonify({'success': False, 'error': 'Purchase order not found'}), 404

        return jsonify({
            'success': True,
            'purchaseOrder': po.to_dict(),
            'purchase_order': po.to_dict()
        }), 200

    except Exception as e:
        print(f"Error in get_purchase_order: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order', methods=['POST'])
def create_purchase_order():
    """Create new purchase order"""
    try:
        data = request.json or {}

        supplier_name = str(data.get('supplierName') or data.get('supplier_name') or '').strip()
        if not supplier_name:
            return jsonify({'success': False, 'error': 'Supplier name is required'}), 400

        items_data = data.get('items', [])
        if not items_data or len(items_data) == 0:
            return jsonify({'success': False, 'error': 'At least one item is required'}), 400

        # Parse dates
        po_date_raw = data.get('poDate') or data.get('po_date')
        try:
            po_date = datetime.strptime(po_date_raw, '%Y-%m-%d').date() if po_date_raw else datetime.now().date()
        except (ValueError, TypeError):
            po_date = datetime.now().date()

        delivery_date_raw = data.get('deliveryDate') or data.get('delivery_date')
        delivery_date = None
        if delivery_date_raw:
            try:
                delivery_date = datetime.strptime(delivery_date_raw, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                delivery_date = None

        po_number = str(data.get('poNumber') or data.get('po_number') or '').strip()
        if not po_number or PurchaseOrder.query.filter_by(po_number=po_number).first():
            po_number = generate_po_number()

        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=data.get('supplierId') or data.get('supplier_id'),
            supplier_name=supplier_name,
            attn=str(data.get('attn') or '').strip(),
            supplier_address=str(data.get('supplierAddress') or data.get('supplier_address') or '').strip(),
            supplier_phone=str(data.get('supplierPhone') or data.get('supplier_phone') or '').strip(),
            supplier_email=str(data.get('supplierEmail') or data.get('supplier_email') or '').strip(),
            po_date=po_date,
            delivery_date=delivery_date,
            deliver_to=str(data.get('deliverTo') or data.get('deliver_to') or DEFAULT_DELIVER_TO).strip(),
            your_quote_ref=str(data.get('yourQuoteRef') or data.get('your_quote_ref') or '').strip(),
            status=str(data.get('status') or 'issued').lower(),
            terms=str(data.get('terms') or DEFAULT_PO_TERMS),
            notes=str(data.get('notes') or '').strip(),
            authorised_by=str(data.get('authorisedBy') or data.get('authorised_by') or 'PowerQ Max Engineering Pte Ltd').strip()
        )

        db.session.add(po)
        db.session.flush()

        # Add items
        item_idx = 1
        for item_data in items_data:
            desc = str(item_data.get('description') or item_data.get('product_name') or item_data.get('productName') or '').strip()
            if not desc:
                continue

            try:
                qty = float(item_data.get('quantity', 1))
            except (ValueError, TypeError):
                qty = 1.0

            try:
                unit_price = float(item_data.get('unitPrice', item_data.get('unit_price', item_data.get('price', 0))))
            except (ValueError, TypeError):
                unit_price = 0.0

            amount = round(qty * unit_price, 2)

            item = PurchaseOrderItem(
                purchase_order_id=po.id,
                product_id=item_data.get('productId') or item_data.get('product_id'),
                item_no=item_idx,
                description=desc,
                quantity=qty,
                unit=str(item_data.get('unit') or 'nos').strip(),
                unit_price=unit_price,
                amount=amount
            )
            db.session.add(item)
            item_idx += 1

        po.calculate_totals()
        db.session.commit()

        created_po = PurchaseOrder.query.get(po.id)

        return jsonify({
            'success': True,
            'message': 'Purchase order created successfully',
            'purchaseOrder': created_po.to_dict(),
            'poNumber': created_po.po_number
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERROR creating purchase order: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order/<int:id>', methods=['PUT'])
def update_purchase_order(id):
    """Update existing purchase order"""
    try:
        po = PurchaseOrder.query.get(id)
        if not po:
            return jsonify({'success': False, 'error': 'Purchase order not found'}), 404

        data = request.json or {}

        if 'supplierName' in data or 'supplier_name' in data:
            po.supplier_name = str(data.get('supplierName') or data.get('supplier_name') or '').strip()
        if 'supplierId' in data or 'supplier_id' in data:
            po.supplier_id = data.get('supplierId') or data.get('supplier_id')
        if 'attn' in data:
            po.attn = str(data.get('attn') or '').strip()
        if 'supplierAddress' in data or 'supplier_address' in data:
            po.supplier_address = str(data.get('supplierAddress') or data.get('supplier_address') or '').strip()
        if 'supplierPhone' in data or 'supplier_phone' in data:
            po.supplier_phone = str(data.get('supplierPhone') or data.get('supplier_phone') or '').strip()
        if 'supplierEmail' in data or 'supplier_email' in data:
            po.supplier_email = str(data.get('supplierEmail') or data.get('supplier_email') or '').strip()

        if 'poDate' in data or 'po_date' in data:
            po_date_raw = data.get('poDate') or data.get('po_date')
            try:
                po.po_date = datetime.strptime(po_date_raw, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                pass

        if 'deliveryDate' in data or 'delivery_date' in data:
            delivery_date_raw = data.get('deliveryDate') or data.get('delivery_date')
            if delivery_date_raw:
                try:
                    po.delivery_date = datetime.strptime(delivery_date_raw, '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    po.delivery_date = None
            else:
                po.delivery_date = None

        if 'deliverTo' in data or 'deliver_to' in data:
            po.deliver_to = str(data.get('deliverTo') or data.get('deliver_to') or DEFAULT_DELIVER_TO).strip()
        if 'yourQuoteRef' in data or 'your_quote_ref' in data:
            po.your_quote_ref = str(data.get('yourQuoteRef') or data.get('your_quote_ref') or '').strip()
        if 'status' in data:
            po.status = str(data.get('status') or 'issued').lower()
        if 'terms' in data:
            po.terms = str(data.get('terms') or DEFAULT_PO_TERMS)
        if 'notes' in data:
            po.notes = str(data.get('notes') or '').strip()
        if 'authorisedBy' in data or 'authorised_by' in data:
            po.authorised_by = str(data.get('authorisedBy') or data.get('authorised_by') or '').strip()

        # Update items if provided
        if 'items' in data and isinstance(data['items'], list):
            PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).delete()
            item_idx = 1
            for item_data in data['items']:
                desc = str(item_data.get('description') or item_data.get('product_name') or item_data.get('productName') or '').strip()
                if not desc:
                    continue

                try:
                    qty = float(item_data.get('quantity', 1))
                except (ValueError, TypeError):
                    qty = 1.0

                try:
                    unit_price = float(item_data.get('unitPrice', item_data.get('unit_price', item_data.get('price', 0))))
                except (ValueError, TypeError):
                    unit_price = 0.0

                amount = round(qty * unit_price, 2)

                item = PurchaseOrderItem(
                    purchase_order_id=po.id,
                    product_id=item_data.get('productId') or item_data.get('product_id'),
                    item_no=item_idx,
                    description=desc,
                    quantity=qty,
                    unit=str(item_data.get('unit') or 'nos').strip(),
                    unit_price=unit_price,
                    amount=amount
                )
                db.session.add(item)
                item_idx += 1

        po.calculate_totals()
        db.session.commit()

        updated_po = PurchaseOrder.query.get(po.id)
        return jsonify({
            'success': True,
            'message': 'Purchase order updated successfully',
            'purchaseOrder': updated_po.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"ERROR updating purchase order: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order/<int:id>', methods=['DELETE'])
def delete_purchase_order(id):
    """Delete purchase order"""
    try:
        po = PurchaseOrder.query.get(id)
        if not po:
            return jsonify({'success': False, 'error': 'Purchase order not found'}), 404

        db.session.delete(po)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Purchase order deleted successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"ERROR deleting purchase order: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order/<int:id>/status', methods=['PATCH'])
def update_purchase_order_status(id):
    """Quick update status for purchase order"""
    try:
        po = PurchaseOrder.query.get(id)
        if not po:
            return jsonify({'success': False, 'error': 'Purchase order not found'}), 404

        data = request.json or {}
        status = str(data.get('status') or '').strip().lower()
        if not status:
            return jsonify({'success': False, 'error': 'Status is required'}), 400

        po.status = status
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"Purchase order status updated to {status}",
            'purchaseOrder': po.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order/stats/dashboard', methods=['GET'])
def get_po_dashboard_stats():
    """Get purchase order summary statistics"""
    try:
        today = datetime.now().date()
        start_of_month = today.replace(day=1)

        total_orders = PurchaseOrder.query.count()
        total_amount = db.session.query(func.sum(PurchaseOrder.total)).scalar() or 0.0

        issued_count = PurchaseOrder.query.filter_by(status='issued').count()
        completed_count = PurchaseOrder.query.filter_by(status='completed').count()
        draft_count = PurchaseOrder.query.filter_by(status='draft').count()

        month_orders = PurchaseOrder.query.filter(PurchaseOrder.po_date >= start_of_month).count()
        month_amount = db.session.query(func.sum(PurchaseOrder.total)).filter(
            PurchaseOrder.po_date >= start_of_month
        ).scalar() or 0.0

        return jsonify({
            'success': True,
            'stats': {
                'totalOrders': total_orders,
                'totalAmount': round(float(total_amount), 2),
                'issuedOrders': issued_count,
                'completedOrders': completed_count,
                'draftOrders': draft_count,
                'monthOrders': month_orders,
                'monthAmount': round(float(month_amount), 2)
            }
        }), 200

    except Exception as e:
        print(f"Error getting PO stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@purchase_order_bp.route('/purchase-order/number/generate', methods=['GET'])
def generate_number():
    """Generate next PO number"""
    try:
        po_number = generate_po_number()
        return jsonify({'success': True, 'poNumber': po_number}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
