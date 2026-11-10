from app import db
from datetime import datetime, timedelta

DEFAULT_PO_TERMS = """1. Please quote this PO number on all delivery orders and invoices.
2. Goods must match the specifications and quantities stated. PowerQ Max Engineering Pte Ltd may reject any goods that do not.
3. Deliver to the address and on the date stated. Please inform us immediately of any delay.
4. The prices stated are fixed unless agreed otherwise in writing.
5. Payment will be made within 30 days of receiving a correct invoice with a signed delivery order."""

DEFAULT_DELIVER_TO = """PowerQ Max Engineering Pte Ltd
10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787"""

class PurchaseOrder(db.Model):
    __tablename__ = 'purchase_orders'

    id = db.Column(db.Integer, primary_key=True)
    po_number = db.Column(db.String(50), unique=True, nullable=False)

    # Supplier details
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id', ondelete='SET NULL'), nullable=True)
    supplier_name = db.Column(db.String(100), nullable=False)
    attn = db.Column(db.String(100), nullable=True)
    supplier_address = db.Column(db.Text, nullable=True)
    supplier_phone = db.Column(db.String(50), nullable=True)
    supplier_email = db.Column(db.String(100), nullable=True)

    # PO Meta details (matching the uploaded image!)
    po_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    delivery_date = db.Column(db.Date, nullable=True)
    deliver_to = db.Column(db.Text, nullable=True, default=DEFAULT_DELIVER_TO)
    your_quote_ref = db.Column(db.String(100), nullable=True)

    # Financial details
    subtotal = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, default=0.0)

    # Terms & Status
    status = db.Column(db.String(30), default='issued')  # draft, issued, partially_received, completed, cancelled
    terms = db.Column(db.Text, default=DEFAULT_PO_TERMS)
    notes = db.Column(db.Text, default='')
    authorised_by = db.Column(db.String(100), default='PowerQ Max Engineering Pte Ltd')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = db.relationship('PurchaseOrderItem', backref='purchase_order', lazy=True, cascade='all, delete-orphan')
    supplier = db.relationship('Supplier', backref=db.backref('purchase_orders', lazy=True))

    def __init__(self, **kwargs):
        super(PurchaseOrder, self).__init__(**kwargs)

    def calculate_totals(self):
        """Calculate subtotal and final total from items"""
        if not self.items:
            self.items = []
        self.subtotal = round(sum(float(item.amount or 0) for item in self.items), 2)
        self.total = self.subtotal

    def to_dict(self):
        return {
            'id': self.id,
            'po_number': self.po_number,
            'poNumber': self.po_number,
            'supplier_id': self.supplier_id,
            'supplierId': self.supplier_id,
            'supplier_name': self.supplier_name,
            'supplierName': self.supplier_name,
            'attn': self.attn or '',
            'supplier_address': self.supplier_address or '',
            'supplierAddress': self.supplier_address or '',
            'supplier_phone': self.supplier_phone or '',
            'supplierPhone': self.supplier_phone or '',
            'supplier_email': self.supplier_email or '',
            'supplierEmail': self.supplier_email or '',
            'po_date': self.po_date.isoformat() if self.po_date else None,
            'poDate': self.po_date.isoformat() if self.po_date else None,
            'delivery_date': self.delivery_date.isoformat() if self.delivery_date else None,
            'deliveryDate': self.delivery_date.isoformat() if self.delivery_date else None,
            'deliver_to': self.deliver_to or DEFAULT_DELIVER_TO,
            'deliverTo': self.deliver_to or DEFAULT_DELIVER_TO,
            'your_quote_ref': self.your_quote_ref or '',
            'yourQuoteRef': self.your_quote_ref or '',
            'subtotal': float(self.subtotal or 0),
            'total': float(self.total or 0),
            'status': self.status,
            'terms': self.terms or DEFAULT_PO_TERMS,
            'notes': self.notes or '',
            'authorised_by': self.authorised_by or 'PowerQ Max Engineering Pte Ltd',
            'authorisedBy': self.authorised_by or 'PowerQ Max Engineering Pte Ltd',
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class PurchaseOrderItem(db.Model):
    __tablename__ = 'purchase_order_items'

    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id', ondelete='SET NULL'), nullable=True)

    item_no = db.Column(db.Integer, default=1)
    description = db.Column(db.Text, nullable=False)
    quantity = db.Column(db.Float, default=1.0)
    unit = db.Column(db.String(20), default='nos')
    unit_price = db.Column(db.Float, default=0.0)
    amount = db.Column(db.Float, default=0.0)

    product = db.relationship('Product')

    def __init__(self, **kwargs):
        super(PurchaseOrderItem, self).__init__(**kwargs)

    def calculate_amount(self):
        self.amount = round(float(self.quantity or 0) * float(self.unit_price or 0), 2)
        return self.amount

    def to_dict(self):
        return {
            'id': self.id,
            'purchase_order_id': self.purchase_order_id,
            'purchaseOrderId': self.purchase_order_id,
            'product_id': self.product_id,
            'productId': self.product_id,
            'item_no': self.item_no,
            'itemNo': self.item_no,
            'description': self.description,
            'quantity': float(self.quantity or 0),
            'unit': self.unit or 'nos',
            'unit_price': float(self.unit_price or 0),
            'unitPrice': float(self.unit_price or 0),
            'amount': float(self.amount or 0)
        }


def ensure_purchase_order_schema(engine=None):
    """
    Ensure purchase_orders and purchase_order_items tables exist with all required columns.
    """
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        with target_engine.connect() as conn:
            if 'purchase_orders' not in tables:
                conn.execute(text("""
                    CREATE TABLE purchase_orders (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        po_number VARCHAR(50) NOT NULL UNIQUE,
                        supplier_id INT NULL,
                        supplier_name VARCHAR(100) NOT NULL,
                        attn VARCHAR(100) NULL,
                        supplier_address TEXT NULL,
                        supplier_phone VARCHAR(50) NULL,
                        supplier_email VARCHAR(100) NULL,
                        po_date DATE NOT NULL,
                        delivery_date DATE NULL,
                        deliver_to TEXT NULL,
                        your_quote_ref VARCHAR(100) NULL,
                        subtotal FLOAT DEFAULT 0.0,
                        total FLOAT DEFAULT 0.0,
                        status VARCHAR(30) DEFAULT 'issued',
                        terms TEXT NULL,
                        notes TEXT NULL,
                        authorised_by VARCHAR(100) DEFAULT 'PowerQ Max Engineering Pte Ltd',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
                    )
                """))
                conn.commit()
                print("Created purchase_orders table")

            if 'purchase_order_items' not in tables:
                conn.execute(text("""
                    CREATE TABLE purchase_order_items (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        purchase_order_id INT NOT NULL,
                        product_id INT NULL,
                        item_no INT DEFAULT 1,
                        description TEXT NOT NULL,
                        quantity FLOAT DEFAULT 1.0,
                        unit VARCHAR(20) DEFAULT 'nos',
                        unit_price FLOAT DEFAULT 0.0,
                        amount FLOAT DEFAULT 0.0,
                        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
                        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
                    )
                """))
                conn.commit()
                print("Created purchase_order_items table")
    except Exception as e:
        print(f"Error in ensure_purchase_order_schema: {e}")
