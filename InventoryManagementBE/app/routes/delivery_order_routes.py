# app/routes/delivery_order_routes.py
from flask import Blueprint, request, jsonify
from app import db
from app.models.delivery_order import DeliveryOrder, DeliveryOrderItem
from app.models.product import Product
from datetime import datetime, date
from sqlalchemy import or_, func
import traceback

delivery_order_bp = Blueprint('delivery_order', __name__)

def generate_do_number():
    """Generate unique sequential DO number: PQM-DO-0001"""
    total = DeliveryOrder.query.count() + 1
    number = f"PQM-DO-{total:04d}"
    while DeliveryOrder.query.filter_by(do_number=number).first():
        total += 1
        number = f"PQM-DO-{total:04d}"
    return number

# ------------------ GET ALL DELIVERY ORDERS ------------------
@delivery_order_bp.route('/delivery-order', methods=['GET'])
def get_delivery_orders():
    """Get delivery orders with pagination, search, and filters"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '').strip()
        status = request.args.get('status', '').strip()
        from_date = request.args.get('from_date', '').strip()
        to_date = request.args.get('to_date', '').strip()

        query = DeliveryOrder.query

        if search:
            query = query.filter(
                or_(
                    DeliveryOrder.do_number.ilike(f'%{search}%'),
                    DeliveryOrder.customer_name.ilike(f'%{search}%'),
                    DeliveryOrder.customer_phone.ilike(f'%{search}%'),
                    DeliveryOrder.your_po_no.ilike(f'%{search}%'),
                    DeliveryOrder.invoice_no.ilike(f'%{search}%'),
                    DeliveryOrder.quotation_no.ilike(f'%{search}%')
                )
            )

        if status and status.lower() != 'all':
            query = query.filter(DeliveryOrder.status == status.lower())

        if from_date:
            try:
                from_dt = datetime.strptime(from_date, '%Y-%m-%d').date()
                query = query.filter(DeliveryOrder.do_date >= from_dt)
            except ValueError:
                pass

        if to_date:
            try:
                to_dt = datetime.strptime(to_date, '%Y-%m-%d').date()
                query = query.filter(DeliveryOrder.do_date <= to_dt)
            except ValueError:
                pass

        query = query.order_by(DeliveryOrder.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'success': True,
            'items': [do.to_dict() for do in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
            'current_page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        print(f"Error in get_delivery_orders: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ GET SINGLE DELIVERY ORDER ------------------
@delivery_order_bp.route('/delivery-order/<int:id>', methods=['GET'])
def get_delivery_order(id):
    """Get single delivery order by ID"""
    try:
        do = DeliveryOrder.query.get(id)
        if not do:
            return jsonify({'success': False, 'error': 'Delivery order not found'}), 404

        return jsonify({
            'success': True,
            'deliveryOrder': do.to_dict(),
            'do': do.to_dict()  # compatibility
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ GET NEXT DO NUMBER ------------------
@delivery_order_bp.route('/delivery-order/next-number', methods=['GET'])
def get_next_do_number():
    """Get next available Delivery Order number"""
    try:
        next_number = generate_do_number()
        return jsonify({
            'success': True,
            'nextNumber': next_number
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ GET STATISTICS ------------------
@delivery_order_bp.route('/delivery-order/statistics', methods=['GET'])
def get_do_statistics():
    """Get delivery order metrics and counts"""
    try:
        total = DeliveryOrder.query.count()
        pending = DeliveryOrder.query.filter_by(status='pending').count()
        dispatched = DeliveryOrder.query.filter_by(status='dispatched').count()
        delivered = DeliveryOrder.query.filter_by(status='delivered').count()
        cancelled = DeliveryOrder.query.filter_by(status='cancelled').count()

        total_qty = db.session.query(func.sum(DeliveryOrder.total_quantity)).scalar() or 0

        return jsonify({
            'success': True,
            'total': total,
            'pending': pending,
            'dispatched': dispatched,
            'delivered': delivered,
            'cancelled': cancelled,
            'totalUnits': int(total_qty)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ CREATE DELIVERY ORDER ------------------
@delivery_order_bp.route('/delivery-order', methods=['POST'])
def create_delivery_order():
    """Create a new delivery order"""
    try:
        data = request.get_json() or {}

        # Validation
        customer_name = data.get('customerName') or data.get('customer_name')
        customer_phone = data.get('customerPhone') or data.get('customer_phone')

        if not customer_name:
            return jsonify({'success': False, 'error': 'Customer Name is required'}), 400
        if not customer_phone:
            return jsonify({'success': False, 'error': 'Customer Phone is required'}), 400

        items_data = data.get('items', [])
        if not items_data or len(items_data) == 0:
            return jsonify({'success': False, 'error': 'At least one item is required'}), 400

        do_number = data.get('doNumber') or data.get('do_number')
        if not do_number:
            do_number = generate_do_number()
        else:
            # Check unique
            existing = DeliveryOrder.query.filter_by(do_number=do_number).first()
            if existing:
                do_number = generate_do_number()

        # Parse date
        do_date = datetime.utcnow().date()
        date_str = data.get('doDate') or data.get('do_date')
        if date_str:
            try:
                do_date = datetime.strptime(date_str[:10], '%Y-%m-%d').date()
            except ValueError:
                pass

        do = DeliveryOrder(
            do_number=do_number,
            customer_name=customer_name.strip(),
            attn=(data.get('attn') or '').strip(),
            customer_phone=customer_phone.strip(),
            customer_email=(data.get('customerEmail') or data.get('customer_email') or '').strip(),
            customer_address=(data.get('customerAddress') or data.get('customer_address') or '').strip(),
            delivery_address=(data.get('deliveryAddress') or data.get('delivery_address') or data.get('customerAddress') or '').strip(),
            do_date=do_date,
            your_po_no=(data.get('yourPoNo') or data.get('your_po_no') or '').strip(),
            invoice_no=(data.get('invoiceNo') or data.get('invoice_no') or '').strip(),
            quotation_no=(data.get('quotationNo') or data.get('quotation_no') or '').strip(),
            delivery_method=(data.get('deliveryMethod') or data.get('delivery_method') or 'Company Delivery').strip(),
            vehicle_no=(data.get('vehicleNo') or data.get('vehicle_no') or '').strip(),
            driver_name=(data.get('driverName') or data.get('driver_name') or '').strip(),
            tracking_no=(data.get('trackingNo') or data.get('tracking_no') or '').strip(),
            status=(data.get('status') or 'pending').strip().lower(),
            prepared_by=(data.get('preparedBy') or data.get('prepared_by') or '').strip(),
            delivered_by=(data.get('deliveredBy') or data.get('delivered_by') or '').strip(),
            notes=(data.get('notes') or '').strip()
        )

        db.session.add(do)
        db.session.flush()

        for item_data in items_data:
            product_name = item_data.get('productName') or item_data.get('product_name') or item_data.get('name', '')
            if not product_name:
                continue

            product_id = item_data.get('productId') or item_data.get('product_id')
            if product_id:
                try:
                    product_id = int(product_id)
                except (ValueError, TypeError):
                    product_id = None

            quantity = int(item_data.get('quantity') or 1)
            unit = item_data.get('unit') or 'nos'
            product_model = item_data.get('productModel') or item_data.get('product_model') or item_data.get('model', '')
            hsn_code = item_data.get('hsnCode') or item_data.get('hsn_code', '')
            remarks = item_data.get('remarks', '')

            item = DeliveryOrderItem(
                delivery_order_id=do.id,
                product_id=product_id,
                product_name=product_name,
                product_model=product_model,
                hsn_code=hsn_code,
                unit=unit,
                quantity=quantity,
                remarks=remarks
            )
            db.session.add(item)

        do.calculate_total_quantity()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Delivery order created successfully',
            'id': do.id,
            'doNumber': do.do_number,
            'deliveryOrder': do.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error in create_delivery_order: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ UPDATE DELIVERY ORDER ------------------
@delivery_order_bp.route('/delivery-order/<int:id>', methods=['PUT'])
def update_delivery_order(id):
    """Update existing delivery order"""
    try:
        do = DeliveryOrder.query.get(id)
        if not do:
            return jsonify({'success': False, 'error': 'Delivery order not found'}), 404

        data = request.get_json() or {}

        if 'customerName' in data or 'customer_name' in data:
            do.customer_name = (data.get('customerName') or data.get('customer_name', '')).strip()
        if 'attn' in data:
            do.attn = (data.get('attn') or '').strip()
        if 'customerPhone' in data or 'customer_phone' in data:
            do.customer_phone = (data.get('customerPhone') or data.get('customer_phone', '')).strip()
        if 'customerEmail' in data or 'customer_email' in data:
            do.customer_email = (data.get('customerEmail') or data.get('customer_email', '')).strip()
        if 'customerAddress' in data or 'customer_address' in data:
            do.customer_address = (data.get('customerAddress') or data.get('customer_address', '')).strip()
        if 'deliveryAddress' in data or 'delivery_address' in data:
            do.delivery_address = (data.get('deliveryAddress') or data.get('delivery_address', '')).strip()

        date_str = data.get('doDate') or data.get('do_date')
        if date_str:
            try:
                do.do_date = datetime.strptime(date_str[:10], '%Y-%m-%d').date()
            except ValueError:
                pass

        if 'yourPoNo' in data or 'your_po_no' in data:
            do.your_po_no = (data.get('yourPoNo') or data.get('your_po_no', '')).strip()
        if 'invoiceNo' in data or 'invoice_no' in data:
            do.invoice_no = (data.get('invoiceNo') or data.get('invoice_no', '')).strip()
        if 'quotationNo' in data or 'quotation_no' in data:
            do.quotation_no = (data.get('quotationNo') or data.get('quotation_no', '')).strip()
        if 'deliveryMethod' in data or 'delivery_method' in data:
            do.delivery_method = (data.get('deliveryMethod') or data.get('delivery_method', '')).strip()
        if 'vehicleNo' in data or 'vehicle_no' in data:
            do.vehicle_no = (data.get('vehicleNo') or data.get('vehicle_no', '')).strip()
        if 'driverName' in data or 'driver_name' in data:
            do.driver_name = (data.get('driverName') or data.get('driver_name', '')).strip()
        if 'trackingNo' in data or 'tracking_no' in data:
            do.tracking_no = (data.get('trackingNo') or data.get('tracking_no', '')).strip()
        if 'status' in data:
            do.status = data.get('status', 'pending').strip().lower()
        if 'preparedBy' in data or 'prepared_by' in data:
            do.prepared_by = (data.get('preparedBy') or data.get('prepared_by', '')).strip()
        if 'deliveredBy' in data or 'delivered_by' in data:
            do.delivered_by = (data.get('deliveredBy') or data.get('delivered_by', '')).strip()
        if 'receivedBy' in data or 'received_by' in data:
            do.received_by = (data.get('receivedBy') or data.get('received_by', '')).strip()
        if 'notes' in data:
            do.notes = (data.get('notes') or '').strip()

        # Update items if provided
        if 'items' in data:
            items_data = data.get('items', [])
            # Delete old items
            DeliveryOrderItem.query.filter_by(delivery_order_id=do.id).delete()

            for item_data in items_data:
                product_name = item_data.get('productName') or item_data.get('product_name') or item_data.get('name', '')
                if not product_name:
                    continue

                product_id = item_data.get('productId') or item_data.get('product_id')
                if product_id:
                    try:
                        product_id = int(product_id)
                    except (ValueError, TypeError):
                        product_id = None

                item = DeliveryOrderItem(
                    delivery_order_id=do.id,
                    product_id=product_id,
                    product_name=product_name,
                    product_model=item_data.get('productModel') or item_data.get('product_model') or item_data.get('model', ''),
                    hsn_code=item_data.get('hsnCode') or item_data.get('hsn_code', ''),
                    unit=item_data.get('unit') or 'nos',
                    quantity=int(item_data.get('quantity') or 1),
                    remarks=item_data.get('remarks', '')
                )
                db.session.add(item)

        do.calculate_total_quantity()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Delivery order updated successfully',
            'deliveryOrder': do.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error in update_delivery_order: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ UPDATE STATUS ------------------
@delivery_order_bp.route('/delivery-order/<int:id>/status', methods=['PATCH'])
def update_do_status(id):
    """Update status of delivery order"""
    try:
        do = DeliveryOrder.query.get(id)
        if not do:
            return jsonify({'success': False, 'error': 'Delivery order not found'}), 404

        data = request.get_json() or {}
        new_status = (data.get('status') or '').strip().lower()

        if new_status not in ['pending', 'dispatched', 'delivered', 'cancelled']:
            return jsonify({'success': False, 'error': 'Invalid status'}), 400

        do.status = new_status

        if new_status == 'delivered':
            do.received_by = (data.get('receivedBy') or data.get('received_by') or do.received_by or '').strip()
            do.received_date = datetime.utcnow()
        elif new_status == 'dispatched':
            if 'driverName' in data or 'driver_name' in data:
                do.driver_name = (data.get('driverName') or data.get('driver_name', '')).strip()
            if 'vehicleNo' in data or 'vehicle_no' in data:
                do.vehicle_no = (data.get('vehicleNo') or data.get('vehicle_no', '')).strip()

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Delivery order status updated to {new_status}',
            'deliveryOrder': do.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------ DELETE DELIVERY ORDER ------------------
@delivery_order_bp.route('/delivery-order/<int:id>', methods=['DELETE'])
def delete_delivery_order(id):
    """Delete a delivery order"""
    try:
        do = DeliveryOrder.query.get(id)
        if not do:
            return jsonify({'success': False, 'error': 'Delivery order not found'}), 404

        db.session.delete(do)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Delivery order deleted successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

