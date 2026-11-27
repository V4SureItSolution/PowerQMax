# app/models/quotation.py
from app import db
from datetime import datetime

class Quotation(db.Model):
    __tablename__ = 'quotations'
    
    id = db.Column(db.Integer, primary_key=True)
    quotation_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # Customer details
    customer_name = db.Column(db.String(100), nullable=False)
    attn = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(100))
    customer_address = db.Column(db.Text)
    customer_gstin = db.Column(db.String(20))
    
    # Quotation details
    quotation_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    valid_until = db.Column(db.Date, nullable=False)
    project = db.Column(db.String(150))
    prepared_by = db.Column(db.String(100))
    
    # Financial details
    subtotal = db.Column(db.Float, default=0)
    discount = db.Column(db.Float, default=0)
    discount_type = db.Column(db.String(20), default='fixed')
    discount_rate = db.Column(db.Float, default=0)
    total = db.Column(db.Float, default=0)
    
    # Additional
    notes = db.Column(db.Text)
    status = db.Column(db.String(20), default='draft')

    # Quotation Approval Details
    approval_status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'rejected'
    approved_by = db.Column(db.String(100), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('QuotationItem', backref='quotation', lazy=True, cascade='all, delete-orphan')
    
    def calculate_totals(self):
        """Calculate subtotal and total"""
        self.subtotal = sum(item.total for item in self.items)
        
        if self.discount_type == 'percentage':
            self.discount = (self.subtotal * self.discount_rate) / 100
        else:
            self.discount = min(self.discount_rate, self.subtotal)
        
        self.total = self.subtotal - self.discount
        
    def to_dict(self):
        """Convert quotation to dictionary"""
        return {
            'id': self.id,
            'quotationNumber': self.quotation_number,
            'quotation_number': self.quotation_number,
            'customerName': self.customer_name,
            'customer_name': self.customer_name,
            'attn': self.attn,
            'customerPhone': self.customer_phone,
            'customer_phone': self.customer_phone,
            'customerEmail': self.customer_email,
            'customer_email': self.customer_email,
            'customerAddress': self.customer_address,
            'customer_address': self.customer_address,
            'customerGstin': self.customer_gstin,
            'customer_gstin': self.customer_gstin,
            'quotationDate': self.quotation_date.isoformat() if self.quotation_date else None,
            'quotation_date': self.quotation_date.isoformat() if self.quotation_date else None,
            'validUntil': self.valid_until.isoformat() if self.valid_until else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'project': self.project,
            'preparedBy': self.prepared_by,
            'prepared_by': self.prepared_by,
            'subtotal': self.subtotal,
            'discount': self.discount,
            'discountType': self.discount_type,
            'discountRate': self.discount_rate,
            'total': self.total,
            'notes': self.notes,
            'status': self.status,
            'approvalStatus': self.approval_status or 'pending',
            'approval_status': self.approval_status or 'pending',
            'approvedBy': self.approved_by,
            'approved_by': self.approved_by,
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejectionReason': self.rejection_reason,
            'rejection_reason': self.rejection_reason,
            'items': [item.to_dict() for item in self.items],
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class QuotationItem(db.Model):
    __tablename__ = 'quotation_items'
    
    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    
    # Snapshot of product details at time of quotation (supports manual entry)
    product_name = db.Column(db.String(100), nullable=False)
    product_model = db.Column(db.String(50))
    price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit = db.Column(db.String(20), default='nos')
    gst = db.Column(db.Float, default=0)
    total = db.Column(db.Float, nullable=False)
    
    # Relationship (optional if product_id is null)
    product = db.relationship('Product')
    
    def calculate_total(self):
        """Calculate item total"""
        self.total = self.price * self.quantity
    
    def to_dict(self):
        """Convert quotation item to dictionary"""
        return {
            'id': self.id,
            'productId': self.product_id,
            'product_id': self.product_id,
            'productName': self.product_name,
            'product_name': self.product_name,
            'productModel': self.product_model,
            'product_model': self.product_model,
            'price': self.price,
            'quantity': self.quantity,
            'unit': self.unit or 'nos',
            'gst': self.gst,
            'total': self.total
        }


def ensure_quotation_schema(engine=None):
    """Ensure quotation tables and approval columns exist."""
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        if 'quotations' not in tables:
            Quotation.__table__.create(target_engine, checkfirst=True)
            print("Created quotations table")
        else:
            cols = [col['name'] for col in inspector.get_columns('quotations')]
            with target_engine.connect() as conn:
                missing_cols = {
                    'approval_status': "ALTER TABLE quotations ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending'",
                    'approved_by':     "ALTER TABLE quotations ADD COLUMN approved_by VARCHAR(100) NULL",
                    'approved_at':     "ALTER TABLE quotations ADD COLUMN approved_at DATETIME NULL",
                    'rejection_reason':"ALTER TABLE quotations ADD COLUMN rejection_reason TEXT NULL",
                    'attn':            "ALTER TABLE quotations ADD COLUMN attn VARCHAR(100) NULL",
                    'project':         "ALTER TABLE quotations ADD COLUMN project VARCHAR(150) NULL",
                    'prepared_by':     "ALTER TABLE quotations ADD COLUMN prepared_by VARCHAR(100) NULL",
                    'customer_gstin':  "ALTER TABLE quotations ADD COLUMN customer_gstin VARCHAR(20) NULL",
                    'discount_rate':   "ALTER TABLE quotations ADD COLUMN discount_rate FLOAT DEFAULT 0",
                    'subtotal':        "ALTER TABLE quotations ADD COLUMN subtotal FLOAT DEFAULT 0",
                    'notes':           "ALTER TABLE quotations ADD COLUMN notes TEXT NULL",
                    'status':          "ALTER TABLE quotations ADD COLUMN status VARCHAR(20) DEFAULT 'draft'",
                }
                for col_name, alter_sql in missing_cols.items():
                    if col_name not in cols:
                        try:
                            conn.execute(text(alter_sql))
                            print(f"Added {col_name} column to quotations")
                        except Exception as e:
                            print(f"Error adding {col_name} column: {e}")
                conn.commit()

        if 'quotation_items' not in tables:
            QuotationItem.__table__.create(target_engine, checkfirst=True)
            print("Created quotation_items table")
        else:
            # Ensure product_id is nullable (manual items have no product_id)
            with target_engine.connect() as conn:
                try:
                    conn.execute(text(
                        "ALTER TABLE quotation_items MODIFY COLUMN product_id INT NULL"
                    ))
                    conn.commit()
                    print("Made quotation_items.product_id nullable")
                except Exception as e:
                    pass  # Already nullable, ignore

    except Exception as e:
        print(f"Error in ensure_quotation_schema: {e}")
