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



def ensure_delivery_order_schema(engine=None):
    """
    Ensure delivery_orders and delivery_order_items tables
    have all required columns for the DeliveryOrder module
    without affecting other modules.
    """
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        if 'delivery_orders' in tables:
            columns = {c['name'] for c in inspector.get_columns('delivery_orders')}
            with target_engine.connect() as conn:
                col_defs = [
                    ('customer_name', "VARCHAR(100) NULL AFTER do_number"),
                    ('customer_phone', "VARCHAR(20) NULL AFTER attn"),
                    ('customer_email', "VARCHAR(100) NULL AFTER customer_phone"),
                    ('customer_address', "TEXT NULL AFTER customer_email"),
                    ('do_date', "DATE NULL AFTER delivery_address"),
                    ('invoice_no', "VARCHAR(100) NULL AFTER your_po_no"),
                    ('quotation_no', "VARCHAR(100) NULL AFTER invoice_no"),
                    ('delivery_method', "VARCHAR(50) DEFAULT 'Company Delivery' AFTER quotation_no"),
                    ('vehicle_no', "VARCHAR(50) NULL AFTER delivery_method"),
                    ('driver_name', "VARCHAR(100) NULL AFTER vehicle_no"),
                    ('tracking_no', "VARCHAR(100) NULL AFTER driver_name"),
                    ('prepared_by', "VARCHAR(100) NULL AFTER status"),
                    ('received_date', "DATETIME NULL AFTER received_by"),
                    ('total_quantity', "INT DEFAULT 0 AFTER received_date")
                ]
                for col_name, col_sql in col_defs:
                    if col_name not in columns:
                        try:
                            conn.execute(text(f"ALTER TABLE delivery_orders ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                        except Exception:
                            pass

                # If legacy columns exist and are NOT NULL, make them nullable so new inserts don't fail
                try:
                    conn.execute(text("ALTER TABLE delivery_orders MODIFY COLUMN to_customer VARCHAR(255) NULL"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE delivery_orders MODIFY COLUMN order_date DATE NULL"))
                    conn.commit()
                except Exception:
                    pass

        if 'delivery_order_items' in tables:
            item_cols = {c['name'] for c in inspector.get_columns('delivery_order_items')}
            with target_engine.connect() as conn:
                item_col_defs = [
                    ('product_name', "VARCHAR(150) NULL AFTER product_id"),
                    ('product_model', "VARCHAR(50) DEFAULT '' AFTER product_name"),
                    ('hsn_code', "VARCHAR(20) DEFAULT '' AFTER product_model")
                ]
                for col_name, col_sql in item_col_defs:
                    if col_name not in item_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE delivery_order_items ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                        except Exception:
                            pass

                try:
                    conn.execute(text("ALTER TABLE delivery_order_items MODIFY COLUMN description TEXT NULL"))
                    conn.commit()
                except Exception:
                    pass

        if 'invoices' in tables:
            inv_cols = {c['name'] for c in inspector.get_columns('invoices')}
            with target_engine.connect() as conn:
                inv_defs = [
                    ('attn', "VARCHAR(100) NULL AFTER customer_gstin"),
                    ('your_po_no', "VARCHAR(100) NULL AFTER due_date"),
                    ('our_do_no', "VARCHAR(100) NULL AFTER your_po_no"),
                    ('bank_name', "VARCHAR(100) NULL AFTER payment_date"),
                    ('account_no', "VARCHAR(100) NULL AFTER bank_name"),
                    ('bank_code', "VARCHAR(50) NULL AFTER account_no")
                ]
                for col_name, col_sql in inv_defs:
                    if col_name not in inv_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                        except Exception:
                            pass

        if 'invoice_items' in tables:
            inv_item_cols = {c['name'] for c in inspector.get_columns('invoice_items')}
            with target_engine.connect() as conn:
                if 'unit' not in inv_item_cols:
                    try:
                        conn.execute(text("ALTER TABLE invoice_items ADD COLUMN unit VARCHAR(20) DEFAULT 'nos' AFTER hsn_code"))
                        conn.commit()
                    except Exception:
                        pass

        if 'quotations' in tables:
            quot_cols = {c['name'] for c in inspector.get_columns('quotations')}
            with target_engine.connect() as conn:
                quot_defs = [
                    ('attn', "VARCHAR(100) NULL AFTER customer_name"),
                    ('project', "VARCHAR(150) NULL AFTER valid_until"),
                    ('prepared_by', "VARCHAR(100) NULL AFTER project")
                ]
                for col_name, col_sql in quot_defs:
                    if col_name not in quot_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE quotations ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                        except Exception:
                            pass

        if 'quotation_items' in tables:
            quot_item_cols = {c['name'] for c in inspector.get_columns('quotation_items')}
            with target_engine.connect() as conn:
                if 'unit' not in quot_item_cols:
                    try:
                        conn.execute(text("ALTER TABLE quotation_items ADD COLUMN unit VARCHAR(20) DEFAULT 'nos' AFTER quantity"))
                        conn.commit()
                    except Exception:
                        pass
    except Exception as e:
        print(f"Error in ensure_delivery_order_schema: {e}")
