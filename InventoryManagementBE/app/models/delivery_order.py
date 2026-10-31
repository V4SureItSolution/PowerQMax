# app/models/delivery_order.py
from app import db
from datetime import datetime

class DeliveryOrder(db.Model):
    __tablename__ = 'delivery_orders'

    id = db.Column(db.Integer, primary_key=True)
    do_number = db.Column(db.String(50), unique=True, nullable=False, index=True)

    # Customer details
    customer_name = db.Column(db.String(100), nullable=False)
    attn = db.Column(db.String(100), nullable=True)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(100), nullable=True)
    customer_address = db.Column(db.Text, nullable=True)
    delivery_address = db.Column(db.Text, nullable=True)

    # DO & Reference details
    do_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    your_po_no = db.Column(db.String(100), nullable=True)
    invoice_no = db.Column(db.String(100), nullable=True)
    quotation_no = db.Column(db.String(100), nullable=True)

    # Delivery & Logistics details
    delivery_method = db.Column(db.String(50), default='Company Delivery')
    vehicle_no = db.Column(db.String(50), nullable=True)
    driver_name = db.Column(db.String(100), nullable=True)
    tracking_no = db.Column(db.String(100), nullable=True)

    # Status: pending, dispatched, delivered, cancelled
    status = db.Column(db.String(20), default='pending')

    # Personnel & Signatures
    prepared_by = db.Column(db.String(100), nullable=True)
    delivered_by = db.Column(db.String(100), nullable=True)
    received_by = db.Column(db.String(100), nullable=True)
    received_date = db.Column(db.DateTime, nullable=True)

    # Quantities & Notes
    total_quantity = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text, default='')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = db.relationship('DeliveryOrderItem', backref='delivery_order', lazy=True, cascade='all, delete-orphan')

    def calculate_total_quantity(self):
        """Calculate total number of items delivered"""
        self.total_quantity = sum(item.quantity for item in self.items)

    def to_dict(self):
        """Convert delivery order to dictionary for frontend"""
        return {
            'id': self.id,
            'doNumber': self.do_number,
            'do_number': self.do_number,
            'customerName': self.customer_name,
            'customer_name': self.customer_name,
            'attn': self.attn or '',
            'customerPhone': self.customer_phone,
            'customer_phone': self.customer_phone,
            'customerEmail': self.customer_email or '',
            'customer_email': self.customer_email or '',
            'customerAddress': self.customer_address or '',
            'customer_address': self.customer_address or '',
            'deliveryAddress': self.delivery_address or self.customer_address or '',
            'delivery_address': self.delivery_address or self.customer_address or '',
            'doDate': self.do_date.isoformat() if self.do_date else None,
            'do_date': self.do_date.isoformat() if self.do_date else None,
            'yourPoNo': self.your_po_no or '',
            'your_po_no': self.your_po_no or '',
            'invoiceNo': self.invoice_no or '',
            'invoice_no': self.invoice_no or '',
            'quotationNo': self.quotation_no or '',
            'quotation_no': self.quotation_no or '',
            'deliveryMethod': self.delivery_method or 'Company Delivery',
            'delivery_method': self.delivery_method or 'Company Delivery',
            'vehicleNo': self.vehicle_no or '',
            'vehicle_no': self.vehicle_no or '',
            'driverName': self.driver_name or '',
            'driver_name': self.driver_name or '',
            'trackingNo': self.tracking_no or '',
            'tracking_no': self.tracking_no or '',
            'status': self.status or 'pending',
            'preparedBy': self.prepared_by or '',
            'prepared_by': self.prepared_by or '',
            'deliveredBy': self.delivered_by or '',
            'delivered_by': self.delivered_by or '',
            'receivedBy': self.received_by or '',
            'received_by': self.received_by or '',
            'receivedDate': self.received_date.isoformat() if self.received_date else None,
            'received_date': self.received_date.isoformat() if self.received_date else None,
            'totalQuantity': self.total_quantity,
            'total_quantity': self.total_quantity,
            'notes': self.notes or '',
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items]
        }


class DeliveryOrderItem(db.Model):
    __tablename__ = 'delivery_order_items'

    id = db.Column(db.Integer, primary_key=True)
    delivery_order_id = db.Column(db.Integer, db.ForeignKey('delivery_orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)

    # Product snapshot
    product_name = db.Column(db.String(150), nullable=False)
    product_model = db.Column(db.String(50), default='')
    hsn_code = db.Column(db.String(20), default='')
    unit = db.Column(db.String(20), default='nos')
    quantity = db.Column(db.Integer, nullable=False, default=1)
    remarks = db.Column(db.String(255), default='')

    # Relationship
    product = db.relationship('Product')

    def to_dict(self):
        """Convert delivery order item to dictionary"""
        return {
            'id': self.id,
            'deliveryOrderId': self.delivery_order_id,
            'delivery_order_id': self.delivery_order_id,
            'productId': self.product_id,
            'product_id': self.product_id,
            'productName': self.product_name,
            'product_name': self.product_name,
            'name': self.product_name,
            'productModel': self.product_model or '',
            'product_model': self.product_model or '',
            'model': self.product_model or '',
            'hsnCode': self.hsn_code or '',
            'hsn_code': self.hsn_code or '',
            'unit': self.unit or 'nos',
            'quantity': self.quantity or 1,
            'remarks': self.remarks or ''
        }

