from app import db
from datetime import datetime, timedelta

class Invoice(db.Model):
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # Customer details
    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(100))
    customer_address = db.Column(db.Text)
    customer_gstin = db.Column(db.String(20))
    attn = db.Column(db.String(100), nullable=True)
    
    # Invoice details
    invoice_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    due_date = db.Column(db.Date, nullable=False)
    your_po_no = db.Column(db.String(100), nullable=True)
    our_do_no = db.Column(db.String(100), nullable=True)
    
    # Financial details
    subtotal = db.Column(db.Float, default=0.0)
    discount = db.Column(db.Float, default=0.0)
    discount_type = db.Column(db.String(20), default='fixed')
    discount_rate = db.Column(db.Float, default=0.0)
    
    # Tax details
    cgst_total = db.Column(db.Float, default=0.0)
    sgst_total = db.Column(db.Float, default=0.0)
    igst_total = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, default=0.0)
    
    # Payment details
    payment_method = db.Column(db.String(20), default='cash')
    payment_status = db.Column(db.String(20), default='unpaid')
    payment_date = db.Column(db.DateTime, nullable=True)
    bank_name = db.Column(db.String(100), nullable=True)
    account_no = db.Column(db.String(100), nullable=True)
    bank_code = db.Column(db.String(50), nullable=True)
    account_name = db.Column(db.String(150), nullable=True)
    paynow_uen = db.Column(db.String(50), nullable=True)
    branch_code = db.Column(db.String(100), nullable=True)
    swift_code = db.Column(db.String(50), nullable=True)
    bank_address = db.Column(db.Text, nullable=True)
    intermediary_bank = db.Column(db.String(255), nullable=True)
    intermediary_swift_code = db.Column(db.String(50), nullable=True)
    
    # Additional
    notes = db.Column(db.Text, default='')
    terms = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, shipped, delivered, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('InvoiceItem', backref='invoice', lazy=True, cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super(Invoice, self).__init__(**kwargs)
    
    def calculate_totals(self):
        """Calculate subtotal, tax totals and final total"""
        # Ensure items are loaded
        if not self.items:
            self.items = []
        
        # Calculate subtotal from items
        self.subtotal = sum(float(item.total) for item in self.items if item.total)
        
        # Calculate discount
        if self.discount_type == 'percentage':
            self.discount = (self.subtotal * float(self.discount_rate)) / 100
        else:
            self.discount = min(float(self.discount_rate), self.subtotal)
        
        taxable_amount = self.subtotal - self.discount
        
        # Calculate tax totals based on items
        self.cgst_total = sum(float(item.cgst) for item in self.items if item.cgst)
        self.sgst_total = sum(float(item.sgst) for item in self.items if item.sgst)
        self.igst_total = sum(float(item.igst) for item in self.items if item.igst)
        
        # Final total
        self.total = taxable_amount + self.cgst_total + self.sgst_total + self.igst_total
        
        # Round to 2 decimal places
        self.subtotal = round(self.subtotal, 2)
        self.discount = round(self.discount, 2)
        self.cgst_total = round(self.cgst_total, 2)
        self.sgst_total = round(self.sgst_total, 2)
        self.igst_total = round(self.igst_total, 2)
        self.total = round(self.total, 2)
        
    def get_transaction_type(self):
        """Determine if transaction is intra-state or inter-state"""
        return 'inter_state' if self.igst_total and self.igst_total > 0 else 'intra_state'
    
    def is_overdue(self):
        """Check if invoice is overdue"""
        if self.payment_status == 'paid':
            return False
        if not self.due_date:
            return False
        return self.due_date < datetime.now().date()
    
    def to_dict(self):
        """Convert invoice to dictionary with proper date handling"""
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'invoiceNumber': self.invoice_number,  # Keep both for compatibility
            'customer_name': self.customer_name,
            'customerName': self.customer_name,  # Keep both for compatibility
            'customer_phone': self.customer_phone,
            'customerPhone': self.customer_phone,  # Keep both for compatibility
            'customer_email': self.customer_email or '',
            'customerEmail': self.customer_email or '',  # Keep both for compatibility
            'customer_address': self.customer_address or '',
            'customerAddress': self.customer_address or '',  # Keep both for compatibility
            'customer_gstin': self.customer_gstin or '',
            'customerGstin': self.customer_gstin or '',  # Keep both for compatibility
            'attn': self.attn or '',
            'your_po_no': self.your_po_no or '',
            'yourPoNo': self.your_po_no or '',
            'our_do_no': self.our_do_no or '',
            'ourDoNo': self.our_do_no or '',
            'bank_name': self.bank_name or 'Oversea-Chinese Banking Corporation Limited Singapore',
            'bankName': self.bank_name or 'Oversea-Chinese Banking Corporation Limited Singapore',
            'account_no': self.account_no or '',
            'accountNo': self.account_no or '',
            'bank_code': self.bank_code or '7339',
            'bankCode': self.bank_code or '7339',
            'account_name': self.account_name or 'PowerQ Max Engineering Pte Ltd',
            'accountName': self.account_name or 'PowerQ Max Engineering Pte Ltd',
            'paynow_uen': self.paynow_uen or '202649167W',
            'paynowUen': self.paynow_uen or '202649167W',
            'branch_code': self.branch_code or 'First 3 digits of your account number',
            'branchCode': self.branch_code or 'First 3 digits of your account number',
            'swift_code': self.swift_code or 'OCBCSGSG',
            'swiftCode': self.swift_code or 'OCBCSGSG',
            'bank_address': self.bank_address or 'OCBC Bank\n65 Chulia Street,\nOCBC Centre,\nSingapore 049513',
            'bankAddress': self.bank_address or 'OCBC Bank\n65 Chulia Street,\nOCBC Centre,\nSingapore 049513',
            'intermediary_bank': self.intermediary_bank or 'JP Morgan Chase Bank, New York, USA (for Telegraphic Transfer in USD)',
            'intermediaryBank': self.intermediary_bank or 'JP Morgan Chase Bank, New York, USA (for Telegraphic Transfer in USD)',
            'intermediary_swift_code': self.intermediary_swift_code or 'CHASUS33',
            'intermediarySwiftCode': self.intermediary_swift_code or 'CHASUS33',
            'invoice_date': self.invoice_date.isoformat() if self.invoice_date else None,
            'invoiceDate': self.invoice_date.isoformat() if self.invoice_date else None,  # Keep both for compatibility
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'dueDate': self.due_date.isoformat() if self.due_date else None,  # Keep both for compatibility
            'subtotal': float(self.subtotal) if self.subtotal is not None else 0,
            'discount': float(self.discount) if self.discount is not None else 0,
            'discount_type': self.discount_type,
            'discountType': self.discount_type,  # Keep both for compatibility
            'discount_rate': float(self.discount_rate) if self.discount_rate is not None else 0,
            'discountRate': float(self.discount_rate) if self.discount_rate is not None else 0,  # Keep both for compatibility
            'cgst_total': float(self.cgst_total) if self.cgst_total is not None else 0,
            'cgstTotal': float(self.cgst_total) if self.cgst_total is not None else 0,  # Keep both for compatibility
            'sgst_total': float(self.sgst_total) if self.sgst_total is not None else 0,
            'sgstTotal': float(self.sgst_total) if self.sgst_total is not None else 0,  # Keep both for compatibility
            'igst_total': float(self.igst_total) if self.igst_total is not None else 0,
            'igstTotal': float(self.igst_total) if self.igst_total is not None else 0,  # Keep both for compatibility
            'total': float(self.total) if self.total is not None else 0,
            'payment_method': self.payment_method,
            'paymentMethod': self.payment_method,  # Keep both for compatibility
            'payment_status': self.payment_status,
            'paymentStatus': self.payment_status,  # Keep both for compatibility
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'paymentDate': self.payment_date.isoformat() if self.payment_date else None,  # Keep both for compatibility
            'notes': self.notes or '',
            'terms': self.terms or '',
            'status': self.status,
            'is_overdue': self.is_overdue(),
            'isOverdue': self.is_overdue(),  # Keep both for compatibility
            'transaction_type': self.get_transaction_type(),
            'transactionType': self.get_transaction_type(),  # Keep both for compatibility
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,  # Keep both for compatibility
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None  # Keep both for compatibility
        }


class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    
    # Snapshot of product details at time of invoicing
    product_name = db.Column(db.String(100), nullable=False)
    product_model = db.Column(db.String(50), default='')
    hsn_code = db.Column(db.String(20), default='')
    unit = db.Column(db.String(20), default='nos')
    price = db.Column(db.Float, nullable=False, default=0.0)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    gst_rate = db.Column(db.Float, default=0.0)
    
    # Tax amounts
    cgst = db.Column(db.Float, default=0.0)
    sgst = db.Column(db.Float, default=0.0)
    igst = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, nullable=False, default=0.0)
    
    # Relationship
    product = db.relationship('Product')

    def __init__(self, **kwargs):
        super(InvoiceItem, self).__init__(**kwargs)
    
    def calculate_totals(self, is_inter_state=False):
        """Calculate item total and tax amounts"""
        # Calculate base total
        item_total = float(self.price) * int(self.quantity)
        self.total = round(item_total, 2)
        
        # Calculate GST if applicable
        if self.gst_rate and self.gst_rate > 0:
            # Calculate taxable value (assuming price is inclusive of tax)
            # Formula: Taxable Value = (Total * 100) / (100 + GST Rate)
            taxable_value = (item_total * 100) / (100 + float(self.gst_rate))
            gst_amount = item_total - taxable_value
            
            if is_inter_state:
                # IGST for interstate
                self.igst = round(gst_amount, 2)
                self.cgst = 0.0
                self.sgst = 0.0
            else:
                # CGST + SGST for intrastate
                self.cgst = round(gst_amount / 2, 2)
                self.sgst = round(gst_amount / 2, 2)
                self.igst = 0.0
        else:
            self.cgst = 0.0
            self.sgst = 0.0
            self.igst = 0.0
    
    def to_dict(self):
        """Convert invoice item to dictionary with proper field naming"""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'productId': self.product_id,  # Keep both for compatibility
            'product_name': self.product_name,
            'productName': self.product_name,  # Keep both for compatibility
            'product_model': self.product_model or '',
            'productModel': self.product_model or '',  # Keep both for compatibility
            'hsn_code': self.hsn_code or '',
            'hsnCode': self.hsn_code or '',  # Keep both for compatibility
            'unit': self.unit or 'nos',
            'price': float(self.price) if self.price is not None else 0,
            'quantity': int(self.quantity) if self.quantity is not None else 0,
            'gst_rate': float(self.gst_rate) if self.gst_rate is not None else 0,
            'gstRate': float(self.gst_rate) if self.gst_rate is not None else 0,  # Keep both for compatibility
            'gst': float(self.gst_rate) if self.gst_rate is not None else 0,  # For frontend compatibility
            'cgst': float(self.cgst) if self.cgst is not None else 0,
            'sgst': float(self.sgst) if self.sgst is not None else 0,
            'igst': float(self.igst) if self.igst is not None else 0,
            'total': float(self.total) if self.total is not None else 0
        }


def ensure_invoice_schema(engine=None):
    """
    Ensure invoices table has all required columns for banking and payment details.
    """
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        if 'invoices' in tables:
            columns = {c['name'] for c in inspector.get_columns('invoices')}
            with target_engine.connect() as conn:
                col_defs = [
                    ('account_name', "VARCHAR(150) NULL AFTER bank_code"),
                    ('paynow_uen', "VARCHAR(50) NULL AFTER account_name"),
                    ('branch_code', "VARCHAR(100) NULL AFTER paynow_uen"),
                    ('swift_code', "VARCHAR(50) NULL AFTER branch_code"),
                    ('bank_address', "TEXT NULL AFTER swift_code"),
                    ('intermediary_bank', "VARCHAR(255) NULL AFTER bank_address"),
                    ('intermediary_swift_code', "VARCHAR(50) NULL AFTER intermediary_bank")
                ]
                for col_name, col_sql in col_defs:
                    if col_name not in columns:
                        try:
                            conn.execute(text(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                            print(f"Added column {col_name} to invoices table")
                        except Exception as ce:
                            print(f"Could not add column {col_name}: {ce}")
    except Exception as e:
        print(f"Error in ensure_invoice_schema: {e}")
