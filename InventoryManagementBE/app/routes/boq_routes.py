from flask import Blueprint, request, jsonify
from app.models.boq import (Project, BOQSection, BOQItem,
                             ProgressClaimHeader, ProgressClaimItem,
                             VariationOrder, ApprovalHistory)
from app import db
from datetime import datetime

boq_bp = Blueprint('boq_bp', __name__)


# ── helpers ──────────────────────────────────────────────────────────────────
def _project_number():
    n = Project.query.count() + 1
    num = f"PQM-PRJ-{n:04d}"
    while Project.query.filter_by(project_number=num).first():
        n += 1
        num = f"PQM-PRJ-{n:04d}"
    return num

def _claim_number(project_id):
    count = ProgressClaimHeader.query.filter_by(project_id=project_id).count() + 1
    num = f"PC-{project_id:03d}-{count:02d}"
    while ProgressClaimHeader.query.filter_by(claim_number=num).first():
        count += 1
        num = f"PC-{project_id:03d}-{count:02d}"
    return num

def _vo_number(project_id):
    count = VariationOrder.query.filter_by(project_id=project_id).count() + 1
    return f"VO-{project_id:03d}-{count:02d}"

def _recalc_header(header):
    """Recalculate all payment summary fields for a claim header."""
    items = header.claim_items
    header.current_claim_amount   = round(sum(i.current_amount   for i in items), 2)
    header.cumulative_claim_amount= round(sum(i.cumulative_amount for i in items), 2)
    header.previous_claim_amount  = round(sum(i.prev_amount       for i in items), 2)

    proj = header.project
    header.original_contract_sum = round(proj.original_contract_sum(), 2) if proj else 0

    approved_vos = VariationOrder.query.filter_by(
        project_id=header.project_id, approval_status='approved').all()
    header.variation_add_amount  = round(sum(v.add_amount   for v in approved_vos), 2)
    header.variation_omit_amount = round(sum(v.omit_amount  for v in approved_vos), 2)
    header.revised_contract_sum  = round(
        header.original_contract_sum + header.variation_add_amount - header.variation_omit_amount, 2)

    net = header.current_claim_amount
    header.retention_amount = round(net * (header.retention_pct or 0) / 100, 2)
    header.gst_amount       = round((net - header.retention_amount) * (header.gst_pct or 0) / 100, 2)
    header.final_payable    = round(net - header.retention_amount + header.gst_amount, 2)


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECTS
# ═══════════════════════════════════════════════════════════════════════════════
@boq_bp.route('/boq/projects', methods=['GET'])
def list_projects():
    try:
        status = request.args.get('status')
        q = Project.query
        if status:
            q = q.filter_by(status=status)
        projects = q.order_by(Project.created_at.desc()).all()
        return jsonify([p.to_dict() for p in projects]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>', methods=['GET'])
def get_project(pid):
    try:
        p = Project.query.get_or_404(pid)
        return jsonify(p.to_dict(include_sections=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects', methods=['POST'])
def create_project():
    try:
        d = request.get_json()
        if not d or not d.get('projectName'):
            return jsonify({'error': 'projectName is required'}), 400
        if not d.get('clientName'):
            return jsonify({'error': 'clientName is required'}), 400

        # Build kwargs — only include new columns if they exist in the table
        from sqlalchemy import inspect as sa_inspect
        existing_cols = {c['name'] for c in sa_inspect(db.engine).get_columns('boq_projects')}

        kwargs = dict(
            project_number  = d.get('projectNumber') or _project_number(),
            project_name    = d['projectName'].strip(),
            client_name     = d['clientName'].strip(),
            client_address  = d.get('clientAddress', ''),
            company_name    = d.get('companyName', ''),
            company_address = d.get('companyAddress', ''),
            project_date    = datetime.strptime(d['projectDate'], '%Y-%m-%d').date() if d.get('projectDate') else datetime.utcnow().date(),
            status          = 'active',
            notes           = d.get('notes', ''),
        )
        if 'client_tel'          in existing_cols: kwargs['client_tel']          = d.get('clientTel', '')
        if 'client_email'        in existing_cols: kwargs['client_email']        = d.get('clientEmail', '')
        if 'client_attn'         in existing_cols: kwargs['client_attn']         = d.get('clientAttn', '')
        if 'project_description' in existing_cols: kwargs['project_description'] = d.get('projectDescription', '')

        p = Project(**kwargs)
        db.session.add(p)
        db.session.commit()
        return jsonify({'success': True, 'project': p.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>', methods=['PUT'])
def update_project(pid):
    try:
        p = Project.query.get_or_404(pid)
        d = request.get_json()
        # Always-safe fields
        for field, col in [('projectName','project_name'),('clientName','client_name'),
                           ('clientAddress','client_address'),('companyName','company_name'),
                           ('companyAddress','company_address'),('status','status'),('notes','notes')]:
            if field in d:
                setattr(p, col, d[field])
        if d.get('projectDate'):
            p.project_date = datetime.strptime(d['projectDate'], '%Y-%m-%d').date()
        # New optional columns — only set if column exists
        from sqlalchemy import inspect as sa_inspect
        existing_cols = {c['name'] for c in sa_inspect(db.engine).get_columns('boq_projects')}
        for field, col in [('clientTel','client_tel'),('clientEmail','client_email'),
                           ('clientAttn','client_attn'),('projectDescription','project_description')]:
            if field in d and col in existing_cols:
                setattr(p, col, d[field])
        db.session.commit()
        return jsonify({'success': True, 'project': p.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>', methods=['DELETE'])
def delete_project(pid):
    try:
        p = Project.query.get_or_404(pid)
        db.session.delete(p)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# BOQ SECTIONS
# ═══════════════════════════════════════════════════════════════════════════════
@boq_bp.route('/boq/projects/<int:pid>/sections', methods=['GET'])
def list_sections(pid):
    try:
        Project.query.get_or_404(pid)
        sections = BOQSection.query.filter_by(project_id=pid).order_by(BOQSection.sort_order).all()
        return jsonify([s.to_dict(include_items=True) for s in sections]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>/sections', methods=['POST'])
def create_section(pid):
    try:
        Project.query.get_or_404(pid)
        d = request.get_json()
        max_order = db.session.query(db.func.max(BOQSection.sort_order)).filter_by(project_id=pid).scalar() or 0
        s = BOQSection(project_id=pid, title=d.get('title','New Section').strip(),
                       sort_order=max_order+1)
        db.session.add(s)
        db.session.commit()
        return jsonify({'success': True, 'section': s.to_dict(include_items=True)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/sections/<int:sid>', methods=['PUT'])
def update_section(sid):
    try:
        s = BOQSection.query.get_or_404(sid)
        d = request.get_json()
        if 'title' in d:
            s.title = d['title'].strip()
        if 'sortOrder' in d:
            s.sort_order = d['sortOrder']
        db.session.commit()
        return jsonify({'success': True, 'section': s.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/sections/<int:sid>', methods=['DELETE'])
def delete_section(sid):
    try:
        s = BOQSection.query.get_or_404(sid)
        db.session.delete(s)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# BOQ ITEMS
# ═══════════════════════════════════════════════════════════════════════════════
@boq_bp.route('/boq/sections/<int:sid>/items', methods=['POST'])
def create_item(sid):
    try:
        BOQSection.query.get_or_404(sid)
        d = request.get_json()
        item = BOQItem(
            section_id   = sid,
            item_number  = d.get('itemNumber', ''),
            description  = d.get('description', '').strip(),
            unit         = d.get('unit', 'NOS').upper(),
            contract_qty = float(d.get('contractQty', 0)),
            rate         = float(d.get('rate', 0)),
        )
        item.calc_amount()
        db.session.add(item)
        db.session.commit()
        return jsonify({'success': True, 'item': item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/items/<int:iid>', methods=['PUT'])
def update_item(iid):
    try:
        item = BOQItem.query.get_or_404(iid)
        d = request.get_json()
        if 'itemNumber'  in d: item.item_number  = d['itemNumber']
        if 'description' in d: item.description  = d['description'].strip()
        if 'unit'        in d: item.unit          = d['unit'].upper()
        if 'contractQty' in d: item.contract_qty  = float(d['contractQty'])
        if 'rate'        in d: item.rate          = float(d['rate'])
        item.calc_amount()
        db.session.commit()
        return jsonify({'success': True, 'item': item.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/items/<int:iid>', methods=['DELETE'])
def delete_item(iid):
    try:
        item = BOQItem.query.get_or_404(iid)
        db.session.delete(item)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>/items/bulk', methods=['POST'])
def bulk_create_items(pid):
    """Bulk import BOQ items (from Excel parse on frontend)."""
    try:
        Project.query.get_or_404(pid)
        data = request.get_json()
        sections_data = data.get('sections', [])
        created = 0
        for sec_data in sections_data:
            sec = BOQSection(project_id=pid,
                             title=sec_data.get('title', 'Section').strip(),
                             sort_order=sec_data.get('sortOrder', 0))
            db.session.add(sec)
            db.session.flush()
            for row in sec_data.get('items', []):
                item = BOQItem(
                    section_id   = sec.id,
                    item_number  = row.get('itemNumber', ''),
                    description  = row.get('description', ''),
                    unit         = str(row.get('unit', 'NOS')).upper(),
                    contract_qty = float(row.get('contractQty', 0)),
                    rate         = float(row.get('rate', 0)),
                )
                item.calc_amount()
                db.session.add(item)
                created += 1
        db.session.commit()
        return jsonify({'success': True, 'created': created}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# PROGRESS CLAIM HEADERS
# ═══════════════════════════════════════════════════════════════════════════════
@boq_bp.route('/boq/projects/<int:pid>/claims', methods=['GET'])
def list_claims(pid):
    try:
        Project.query.get_or_404(pid)
        claims = ProgressClaimHeader.query.filter_by(project_id=pid)\
                     .order_by(ProgressClaimHeader.created_at.desc()).all()
        return jsonify([c.to_dict() for c in claims]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/claims', methods=['GET'])
def list_all_claims():
    try:
        status = request.args.get('status')
        q = ProgressClaimHeader.query
        if status:
            q = q.filter_by(status=status)
        claims = q.order_by(ProgressClaimHeader.created_at.desc()).all()
        return jsonify([c.to_dict() for c in claims]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/claims/<int:cid>', methods=['GET'])
def get_claim(cid):
    try:
        c = ProgressClaimHeader.query.get_or_404(cid)
        return jsonify(c.to_dict(include_items=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>/claims', methods=['POST'])
def create_claim(pid):
    try:
        proj = Project.query.get_or_404(pid)
        d = request.get_json()

        header = ProgressClaimHeader(
            claim_number  = _claim_number(pid),
            project_id    = pid,
            claim_date    = datetime.strptime(d['claimDate'], '%Y-%m-%d').date() if d.get('claimDate') else datetime.utcnow().date(),
            period_from   = datetime.strptime(d['periodFrom'], '%Y-%m-%d').date() if d.get('periodFrom') else None,
            period_to     = datetime.strptime(d['periodTo'],   '%Y-%m-%d').date() if d.get('periodTo')   else None,
            retention_pct = float(d.get('retentionPct', 5.0)),
            gst_pct       = float(d.get('gstPct', 9.0)),
            notes         = d.get('notes', ''),
            status        = 'draft',
        )
        db.session.add(header)
        db.session.flush()

        # Get previous cumulative quantities per BOQ item
        prev_claims = ProgressClaimHeader.query.filter(
            ProgressClaimHeader.project_id == pid,
            ProgressClaimHeader.status.in_(['approved']),
            ProgressClaimHeader.id != header.id
        ).order_by(ProgressClaimHeader.created_at.asc()).all()

        prev_qty_map = {}
        for pc in prev_claims:
            for pi in pc.claim_items:
                prev_qty_map[pi.boq_item_id] = pi.cumulative_qty

        # Create claim items for every BOQ item in project
        for section in proj.sections:
            for boq_item in section.items:
                prev_qty = prev_qty_map.get(boq_item.id, 0)
                ci = ProgressClaimItem(
                    header_id   = header.id,
                    boq_item_id = boq_item.id,
                    item_number = boq_item.item_number,
                    description = boq_item.description,
                    unit        = boq_item.unit,
                    contract_qty= boq_item.contract_qty,
                    rate        = boq_item.rate,
                    prev_qty    = prev_qty,
                    current_qty = 0,
                )
                ci.recalculate()
                db.session.add(ci)

        db.session.flush()
        _recalc_header(header)
        db.session.commit()
        return jsonify({'success': True, 'claim': header.to_dict(include_items=True)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/claims/<int:cid>', methods=['PUT'])
def update_claim(cid):
    try:
        header = ProgressClaimHeader.query.get_or_404(cid)
        if header.status not in ('draft', 'rejected'):
            return jsonify({'error': 'Only draft/rejected claims can be edited'}), 400
        d = request.get_json()

        if d.get('claimDate'):
            header.claim_date = datetime.strptime(d['claimDate'], '%Y-%m-%d').date()
        if d.get('periodFrom'):
            header.period_from = datetime.strptime(d['periodFrom'], '%Y-%m-%d').date()
        if d.get('periodTo'):
            header.period_to = datetime.strptime(d['periodTo'], '%Y-%m-%d').date()
        if 'retentionPct' in d: header.retention_pct = float(d['retentionPct'])
        if 'gstPct'       in d: header.gst_pct       = float(d['gstPct'])
        if 'notes'        in d: header.notes          = d['notes']

        # Update claim item quantities
        items_data = d.get('claimItems', [])
        for row in items_data:
            ci = ProgressClaimItem.query.get(row['id'])
            if ci and ci.header_id == cid:
                ci.current_qty = float(row.get('currentQty', ci.current_qty))
                ci.recalculate()

        _recalc_header(header)
        db.session.commit()
        return jsonify({'success': True, 'claim': header.to_dict(include_items=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/claims/<int:cid>', methods=['DELETE'])
def delete_claim(cid):
    try:
        header = ProgressClaimHeader.query.get_or_404(cid)
        if header.status not in ('draft', 'rejected'):
            return jsonify({'error': 'Only draft/rejected claims can be deleted'}), 400
        db.session.delete(header)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Workflow ──────────────────────────────────────────────────────────────────
def _add_history(header_id, action, actor, comment=''):
    h = ApprovalHistory(header_id=header_id, action=action, actor=actor, comment=comment)
    db.session.add(h)


@boq_bp.route('/boq/claims/<int:cid>/submit', methods=['POST'])
def submit_claim(cid):
    try:
        header = ProgressClaimHeader.query.get_or_404(cid)
        if header.status not in ('draft', 'rejected'):
            return jsonify({'error': 'Cannot submit in current state'}), 400
        d = request.get_json() or {}
        header.status = 'submitted'
        header.submitted_at = datetime.utcnow()
        _add_history(cid, 'submitted', d.get('actor', 'User'), d.get('comment', ''))
        db.session.commit()
        return jsonify({'success': True, 'claim': header.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/claims/<int:cid>/approve', methods=['POST'])
def approve_claim(cid):
    try:
        header = ProgressClaimHeader.query.get_or_404(cid)
        if header.status not in ('draft', 'submitted'):
            return jsonify({'error': 'Cannot approve in current state'}), 400
        d = request.get_json() or {}
        header.status = 'approved'
        header.approved_by = d.get('approvedBy', 'Manager')
        header.approved_at = datetime.utcnow()
        _add_history(cid, 'approved', header.approved_by, d.get('comment', ''))
        db.session.commit()
        return jsonify({'success': True, 'claim': header.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/claims/<int:cid>/reject', methods=['POST'])
def reject_claim(cid):
    try:
        header = ProgressClaimHeader.query.get_or_404(cid)
        if header.status not in ('draft', 'submitted'):
            return jsonify({'error': 'Cannot reject in current state'}), 400
        d = request.get_json() or {}
        header.status = 'rejected'
        header.rejection_reason = d.get('rejectionReason', 'Rejected')
        header.approved_by = d.get('approvedBy', 'Manager')
        header.approved_at = datetime.utcnow()
        _add_history(cid, 'rejected', header.approved_by, header.rejection_reason)
        db.session.commit()
        return jsonify({'success': True, 'claim': header.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# VARIATION ORDERS
# ═══════════════════════════════════════════════════════════════════════════════
@boq_bp.route('/boq/projects/<int:pid>/variations', methods=['GET'])
def list_variations(pid):
    try:
        vos = VariationOrder.query.filter_by(project_id=pid)\
                  .order_by(VariationOrder.created_at.desc()).all()
        return jsonify([v.to_dict() for v in vos]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/projects/<int:pid>/variations', methods=['POST'])
def create_variation(pid):
    try:
        Project.query.get_or_404(pid)
        d = request.get_json()
        vo = VariationOrder(
            vo_number        = d.get('voNumber') or _vo_number(pid),
            project_id       = pid,
            vo_date          = datetime.strptime(d['voDate'], '%Y-%m-%d').date() if d.get('voDate') else datetime.utcnow().date(),
            add_description  = d.get('addDescription', ''),
            add_qty          = float(d.get('addQty', 0)),
            add_rate         = float(d.get('addRate', 0)),
            omit_description = d.get('omitDescription', ''),
            omit_amount      = float(d.get('omitAmount', 0)),
            approval_status  = 'pending',
            notes            = d.get('notes', ''),
        )
        vo.calc()
        proj = Project.query.get(pid)
        orig = proj.original_contract_sum() if proj else 0
        vo.revised_contract_amount = round(orig + vo.add_amount - vo.omit_amount, 2)
        db.session.add(vo)
        db.session.commit()
        return jsonify({'success': True, 'variation': vo.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/variations/<int:vid>', methods=['PUT'])
def update_variation(vid):
    try:
        vo = VariationOrder.query.get_or_404(vid)
        d = request.get_json()
        for f, c in [('addDescription','add_description'),('omitDescription','omit_description'),
                     ('notes','notes'),('approvalStatus','approval_status')]:
            if f in d: setattr(vo, c, d[f])
        for f, c in [('addQty','add_qty'),('addRate','add_rate'),('omitAmount','omit_amount')]:
            if f in d: setattr(vo, c, float(d[f]))
        if d.get('voDate'):
            vo.vo_date = datetime.strptime(d['voDate'], '%Y-%m-%d').date()
        vo.calc()
        proj = Project.query.get(vo.project_id)
        orig = proj.original_contract_sum() if proj else 0
        vo.revised_contract_amount = round(orig + vo.add_amount - vo.omit_amount, 2)
        db.session.commit()
        return jsonify({'success': True, 'variation': vo.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@boq_bp.route('/boq/variations/<int:vid>', methods=['DELETE'])
def delete_variation(vid):
    try:
        vo = VariationOrder.query.get_or_404(vid)
        db.session.delete(vo)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
