from app import db
from datetime import datetime


# ─────────────────────────────────────────────
# PROJECT
# ─────────────────────────────────────────────
class Project(db.Model):
    __tablename__ = 'boq_projects'

    id = db.Column(db.Integer, primary_key=True)
    project_number = db.Column(db.String(50), unique=True, nullable=False)
    project_name   = db.Column(db.String(200), nullable=False)
    client_name    = db.Column(db.String(200), nullable=False)
    client_address = db.Column(db.Text)
    client_tel     = db.Column(db.String(50))
    client_email   = db.Column(db.String(200))
    client_attn    = db.Column(db.String(200))
    company_name   = db.Column(db.String(200))
    company_address= db.Column(db.Text)
    project_description = db.Column(db.Text)
    project_date   = db.Column(db.Date, default=datetime.utcnow)
    status         = db.Column(db.String(20), default='active')   # active | completed | cancelled
    notes          = db.Column(db.Text)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sections       = db.relationship('BOQSection', backref='project', lazy=True,
                                     cascade='all, delete-orphan', order_by='BOQSection.sort_order')
    claims         = db.relationship('ProgressClaimHeader', backref='project', lazy=True,
                                     cascade='all, delete-orphan')
    variations     = db.relationship('VariationOrder', backref='project', lazy=True,
                                     cascade='all, delete-orphan')

    def original_contract_sum(self):
        return sum(i.amount for s in self.sections for i in s.items)

    def to_dict(self, include_sections=False):
        d = {
            'id': self.id,
            'projectNumber': self.project_number,
            'projectName': self.project_name,
            'clientName': self.client_name,
            'clientAddress': self.client_address,
            'clientTel': getattr(self, 'client_tel', None),
            'clientEmail': getattr(self, 'client_email', None),
            'clientAttn': getattr(self, 'client_attn', None),
            'companyName': self.company_name,
            'projectDescription': getattr(self, 'project_description', None),
            'companyAddress': self.company_address,
            'projectDate': self.project_date.isoformat() if self.project_date else None,
            'status': self.status,
            'notes': self.notes,
            'originalContractSum': self.original_contract_sum(),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }
        if include_sections:
            d['sections'] = [s.to_dict(include_items=True) for s in self.sections]
        return d


# ─────────────────────────────────────────────
# BOQ SECTION
# ─────────────────────────────────────────────
class BOQSection(db.Model):
    __tablename__ = 'boq_sections'

    id         = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('boq_projects.id'), nullable=False)
    title      = db.Column(db.String(200), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('BOQItem', backref='section', lazy=True,
                            cascade='all, delete-orphan', order_by='BOQItem.item_number')

    def section_total(self):
        return sum(i.amount for i in self.items)

    def to_dict(self, include_items=False):
        d = {
            'id': self.id,
            'projectId': self.project_id,
            'title': self.title,
            'sortOrder': self.sort_order,
            'sectionTotal': self.section_total(),
        }
        if include_items:
            d['items'] = [i.to_dict() for i in self.items]
        return d


# ─────────────────────────────────────────────
# BOQ ITEM
# ─────────────────────────────────────────────
ALLOWED_UNITS = ['M', 'M2', 'M3', 'NOS', 'LOT', 'ITEM', 'KG', 'L', 'SET', 'PCS', 'HR', 'DAY']

class BOQItem(db.Model):
    __tablename__ = 'boq_items'

    id          = db.Column(db.Integer, primary_key=True)
    section_id  = db.Column(db.Integer, db.ForeignKey('boq_sections.id'), nullable=False)
    item_number = db.Column(db.String(20))
    description = db.Column(db.Text, nullable=False)
    unit        = db.Column(db.String(20), default='NOS')
    contract_qty= db.Column(db.Float, default=0)
    rate        = db.Column(db.Float, default=0)
    amount      = db.Column(db.Float, default=0)   # contract_qty × rate
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def calc_amount(self):
        self.amount = round((self.contract_qty or 0) * (self.rate or 0), 2)

    def to_dict(self):
        return {
            'id': self.id,
            'sectionId': self.section_id,
            'itemNumber': self.item_number,
            'description': self.description,
            'unit': self.unit,
            'contractQty': self.contract_qty,
            'rate': self.rate,
            'amount': self.amount,
        }


# ─────────────────────────────────────────────
# PROGRESS CLAIM HEADER
# ─────────────────────────────────────────────
class ProgressClaimHeader(db.Model):
    __tablename__ = 'pc_headers'

    id           = db.Column(db.Integer, primary_key=True)
    claim_number = db.Column(db.String(50), unique=True, nullable=False)
    project_id   = db.Column(db.Integer, db.ForeignKey('boq_projects.id'), nullable=False)
    claim_date   = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    period_from  = db.Column(db.Date)
    period_to    = db.Column(db.Date)

    # Payment config
    retention_pct = db.Column(db.Float, default=5.0)
    gst_pct       = db.Column(db.Float, default=9.0)

    # Computed totals (stored for history)
    original_contract_sum  = db.Column(db.Float, default=0)
    variation_add_amount   = db.Column(db.Float, default=0)
    variation_omit_amount  = db.Column(db.Float, default=0)
    revised_contract_sum   = db.Column(db.Float, default=0)
    previous_claim_amount  = db.Column(db.Float, default=0)
    current_claim_amount   = db.Column(db.Float, default=0)
    cumulative_claim_amount= db.Column(db.Float, default=0)
    retention_amount       = db.Column(db.Float, default=0)
    gst_amount             = db.Column(db.Float, default=0)
    final_payable          = db.Column(db.Float, default=0)

    # Workflow
    status          = db.Column(db.String(20), default='draft')
    submitted_at    = db.Column(db.DateTime)
    approved_by     = db.Column(db.String(100))
    approved_at     = db.Column(db.DateTime)
    rejection_reason= db.Column(db.Text)
    notes           = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    claim_items = db.relationship('ProgressClaimItem', backref='header', lazy=True,
                                  cascade='all, delete-orphan')
    approvals   = db.relationship('ApprovalHistory', backref='claim', lazy=True,
                                  cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        d = {
            'id': self.id,
            'claimNumber': self.claim_number,
            'projectId': self.project_id,
            'projectName': self.project.project_name if self.project else None,
            'clientName': self.project.client_name if self.project else None,
            'claimDate': self.claim_date.isoformat() if self.claim_date else None,
            'periodFrom': self.period_from.isoformat() if self.period_from else None,
            'periodTo': self.period_to.isoformat() if self.period_to else None,
            'retentionPct': self.retention_pct,
            'gstPct': self.gst_pct,
            'originalContractSum': self.original_contract_sum,
            'variationAddAmount': self.variation_add_amount,
            'variationOmitAmount': self.variation_omit_amount,
            'revisedContractSum': self.revised_contract_sum,
            'previousClaimAmount': self.previous_claim_amount,
            'currentClaimAmount': self.current_claim_amount,
            'cumulativeClaimAmount': self.cumulative_claim_amount,
            'retentionAmount': self.retention_amount,
            'gstAmount': self.gst_amount,
            'finalPayable': self.final_payable,
            'status': self.status,
            'submittedAt': self.submitted_at.isoformat() if self.submitted_at else None,
            'approvedBy': self.approved_by,
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'rejectionReason': self.rejection_reason,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            d['claimItems'] = [i.to_dict() for i in self.claim_items]
            d['approvalHistory'] = [a.to_dict() for a in self.approvals]
        return d


# ─────────────────────────────────────────────
# PROGRESS CLAIM ITEM (per BOQ item)
# ─────────────────────────────────────────────
class ProgressClaimItem(db.Model):
    __tablename__ = 'pc_items'

    id             = db.Column(db.Integer, primary_key=True)
    header_id      = db.Column(db.Integer, db.ForeignKey('pc_headers.id'), nullable=False)
    boq_item_id    = db.Column(db.Integer, db.ForeignKey('boq_items.id'), nullable=False)

    # Snapshot
    item_number    = db.Column(db.String(20))
    description    = db.Column(db.Text)
    unit           = db.Column(db.String(20))
    contract_qty   = db.Column(db.Float, default=0)
    rate           = db.Column(db.Float, default=0)

    # Progress
    prev_qty       = db.Column(db.Float, default=0)
    current_qty    = db.Column(db.Float, default=0)
    cumulative_qty = db.Column(db.Float, default=0)   # prev + current
    balance_qty    = db.Column(db.Float, default=0)   # contract - cumulative
    completion_pct = db.Column(db.Float, default=0)   # cumulative/contract*100

    prev_amount    = db.Column(db.Float, default=0)
    current_amount = db.Column(db.Float, default=0)
    cumulative_amount = db.Column(db.Float, default=0)

    boq_item = db.relationship('BOQItem')

    def recalculate(self):
        self.cumulative_qty   = round((self.prev_qty or 0) + (self.current_qty or 0), 4)
        self.balance_qty      = round((self.contract_qty or 0) - self.cumulative_qty, 4)
        self.completion_pct   = round((self.cumulative_qty / self.contract_qty * 100), 2) if self.contract_qty else 0
        self.prev_amount      = round((self.prev_qty or 0) * (self.rate or 0), 2)
        self.current_amount   = round((self.current_qty or 0) * (self.rate or 0), 2)
        self.cumulative_amount= round(self.cumulative_qty * (self.rate or 0), 2)

    def to_dict(self):
        return {
            'id': self.id,
            'headerId': self.header_id,
            'boqItemId': self.boq_item_id,
            'itemNumber': self.item_number,
            'description': self.description,
            'unit': self.unit,
            'contractQty': self.contract_qty,
            'rate': self.rate,
            'prevQty': self.prev_qty,
            'currentQty': self.current_qty,
            'cumulativeQty': self.cumulative_qty,
            'balanceQty': self.balance_qty,
            'completionPct': self.completion_pct,
            'prevAmount': self.prev_amount,
            'currentAmount': self.current_amount,
            'cumulativeAmount': self.cumulative_amount,
        }


# ─────────────────────────────────────────────
# VARIATION ORDER
# ─────────────────────────────────────────────
class VariationOrder(db.Model):
    __tablename__ = 'variation_orders'

    id              = db.Column(db.Integer, primary_key=True)
    vo_number       = db.Column(db.String(50), nullable=False)
    project_id      = db.Column(db.Integer, db.ForeignKey('boq_projects.id'), nullable=False)
    vo_date         = db.Column(db.Date, default=datetime.utcnow)

    # Additional work
    add_description = db.Column(db.Text)
    add_qty         = db.Column(db.Float, default=0)
    add_rate        = db.Column(db.Float, default=0)
    add_amount      = db.Column(db.Float, default=0)

    # Omission
    omit_description= db.Column(db.Text)
    omit_amount     = db.Column(db.Float, default=0)

    revised_contract_amount = db.Column(db.Float, default=0)
    approval_status = db.Column(db.String(20), default='pending')  # pending|approved|rejected
    notes           = db.Column(db.Text)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def calc(self):
        self.add_amount = round((self.add_qty or 0) * (self.add_rate or 0), 2)

    def to_dict(self):
        return {
            'id': self.id,
            'voNumber': self.vo_number,
            'projectId': self.project_id,
            'voDate': self.vo_date.isoformat() if self.vo_date else None,
            'addDescription': self.add_description,
            'addQty': self.add_qty,
            'addRate': self.add_rate,
            'addAmount': self.add_amount,
            'omitDescription': self.omit_description,
            'omitAmount': self.omit_amount,
            'revisedContractAmount': self.revised_contract_amount,
            'approvalStatus': self.approval_status,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }


# ─────────────────────────────────────────────
# APPROVAL HISTORY
# ─────────────────────────────────────────────
class ApprovalHistory(db.Model):
    __tablename__ = 'pc_approval_history'

    id         = db.Column(db.Integer, primary_key=True)
    header_id  = db.Column(db.Integer, db.ForeignKey('pc_headers.id'), nullable=False)
    action     = db.Column(db.String(30))   # submitted|approved|rejected|resubmitted
    actor      = db.Column(db.String(100))
    comment    = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'headerId': self.header_id,
            'action': self.action,
            'actor': self.actor,
            'comment': self.comment,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }


# ─────────────────────────────────────────────
# SCHEMA ENSURE
# ─────────────────────────────────────────────
def ensure_boq_schema(engine=None):
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        # Create missing tables
        for model in [Project, BOQSection, BOQItem, ProgressClaimHeader,
                      ProgressClaimItem, VariationOrder, ApprovalHistory]:
            if model.__tablename__ not in tables:
                model.__table__.create(target_engine, checkfirst=True)
                print(f"Created table: {model.__tablename__}")

        # Re-inspect after possible table creation
        inspector = inspect(target_engine)

        # Add missing columns to boq_projects
        if 'boq_projects' in inspector.get_table_names():
            existing_cols = {c['name'] for c in inspector.get_columns('boq_projects')}
            new_cols = [
                ('client_tel',          'VARCHAR(50)'),
                ('client_email',        'VARCHAR(200)'),
                ('client_attn',         'VARCHAR(200)'),
                ('project_description', 'TEXT'),
            ]
            with target_engine.connect() as conn:
                for col_name, col_type in new_cols:
                    if col_name not in existing_cols:
                        try:
                            conn.execute(text(f'ALTER TABLE boq_projects ADD COLUMN {col_name} {col_type}'))
                            conn.commit()
                            print(f"Added column boq_projects.{col_name}")
                        except Exception as col_err:
                            print(f"Column {col_name} may already exist: {col_err}")
    except Exception as e:
        print(f"Error in ensure_boq_schema: {e}")
