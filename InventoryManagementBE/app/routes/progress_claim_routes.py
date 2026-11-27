from flask import Blueprint, request, jsonify
from app.models.progress_claim import ProgressClaim
from app.models.quotation import Quotation
from app import db
from datetime import datetime

progress_claim_bp = Blueprint('progress_claim_bp', __name__)


def _generate_claim_number():
    total = ProgressClaim.query.count() + 1
    num = f"PQM-PC-{total:04d}"
    while ProgressClaim.query.filter_by(claim_number=num).first():
        total += 1
        num = f"PQM-PC-{total:04d}"
    return num


# GET all progress claims
@progress_claim_bp.route('/progress-claims', methods=['GET'])
def get_all():
    try:
        quotation_id = request.args.get('quotation_id', type=int)
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        q = ProgressClaim.query
        if quotation_id:
            q = q.filter_by(quotation_id=quotation_id)
        if status:
            q = q.filter_by(status=status)
        q = q.order_by(ProgressClaim.created_at.desc())
        pagination = q.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'items': [c.to_dict() for c in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# GET single progress claim
@progress_claim_bp.route('/progress-claims/<int:id>', methods=['GET'])
def get_one(id):
    try:
        claim = ProgressClaim.query.get_or_404(id)
        return jsonify(claim.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# CREATE progress claim
@progress_claim_bp.route('/progress-claims', methods=['POST'])
def create_claim():
    try:
        data = request.get_json()
        quotation_id = data.get('quotationId')
        if not quotation_id:
            return jsonify({'error': 'quotationId is required'}), 400

        quotation = Quotation.query.get_or_404(quotation_id)
        if quotation.approval_status != 'approved':
            return jsonify({'error': 'Only approved quotations can have progress claims'}), 400

        description = (data.get('description') or '').strip()
        if not description:
            return jsonify({'error': 'description is required'}), 400

        claim_percentage = float(data.get('claimPercentage') or 0)
        claim_amount = float(data.get('claimAmount') or 0)

        # If percentage given, derive amount; else derive percentage
        if claim_percentage > 0 and claim_amount == 0:
            claim_amount = round((quotation.total * claim_percentage) / 100, 2)
        elif claim_amount > 0 and claim_percentage == 0:
            claim_percentage = round((claim_amount / quotation.total) * 100, 2) if quotation.total else 0

        # Cumulative claimed so far (approved + submitted claims)
        prev_total = db.session.query(db.func.coalesce(db.func.sum(ProgressClaim.claim_amount), 0)).filter(
            ProgressClaim.quotation_id == quotation_id,
            ProgressClaim.status.in_(['approved', 'submitted', 'invoiced'])
        ).scalar()
        cumulative = round(float(prev_total) + claim_amount, 2)

        if cumulative > quotation.total:
            return jsonify({'error': f'Total claimed (${cumulative:.2f}) exceeds quotation total (${quotation.total:.2f})'}), 400

        claim = ProgressClaim(
            claim_number=_generate_claim_number(),
            quotation_id=quotation_id,
            claim_date=datetime.strptime(data['claimDate'], '%Y-%m-%d').date() if data.get('claimDate') else datetime.utcnow().date(),
            description=description,
            claim_percentage=claim_percentage,
            claim_amount=claim_amount,
            cumulative_claimed=cumulative,
            status='draft',
            notes=data.get('notes', ''),
        )
        db.session.add(claim)
        db.session.commit()
        return jsonify({'success': True, 'claim': claim.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# UPDATE progress claim (only draft)
@progress_claim_bp.route('/progress-claims/<int:id>', methods=['PUT'])
def update_claim(id):
    try:
        claim = ProgressClaim.query.get_or_404(id)
        if claim.status != 'draft':
            return jsonify({'error': 'Only draft claims can be edited'}), 400

        data = request.get_json()
        quotation = claim.quotation

        if 'description' in data:
            claim.description = data['description'].strip()
        if 'claimDate' in data:
            claim.claim_date = datetime.strptime(data['claimDate'], '%Y-%m-%d').date()
        if 'notes' in data:
            claim.notes = data['notes']

        claim_percentage = float(data.get('claimPercentage') or claim.claim_percentage)
        claim_amount = float(data.get('claimAmount') or claim.claim_amount)

        if 'claimPercentage' in data and data['claimPercentage']:
            claim_percentage = float(data['claimPercentage'])
            claim_amount = round((quotation.total * claim_percentage) / 100, 2)
        elif 'claimAmount' in data and data['claimAmount']:
            claim_amount = float(data['claimAmount'])
            claim_percentage = round((claim_amount / quotation.total) * 100, 2) if quotation.total else 0

        claim.claim_percentage = claim_percentage
        claim.claim_amount = claim_amount

        prev_total = db.session.query(db.func.coalesce(db.func.sum(ProgressClaim.claim_amount), 0)).filter(
            ProgressClaim.quotation_id == claim.quotation_id,
            ProgressClaim.status.in_(['approved', 'submitted', 'invoiced']),
            ProgressClaim.id != id
        ).scalar()
        claim.cumulative_claimed = round(float(prev_total) + claim_amount, 2)

        db.session.commit()
        return jsonify({'success': True, 'claim': claim.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# SUBMIT claim for approval
@progress_claim_bp.route('/progress-claims/<int:id>/submit', methods=['POST'])
def submit_claim(id):
    try:
        claim = ProgressClaim.query.get_or_404(id)
        if claim.status != 'draft':
            return jsonify({'error': 'Only draft claims can be submitted'}), 400
        claim.status = 'submitted'
        db.session.commit()
        return jsonify({'success': True, 'claim': claim.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# APPROVE claim
@progress_claim_bp.route('/progress-claims/<int:id>/approve', methods=['POST'])
def approve_claim(id):
    try:
        data = request.get_json() or {}
        claim = ProgressClaim.query.get_or_404(id)
        if claim.status not in ('draft', 'submitted'):
            return jsonify({'error': 'Claim cannot be approved in its current state'}), 400
        claim.status = 'approved'
        claim.approved_by = data.get('approvedBy', 'Manager')
        claim.approved_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'success': True, 'claim': claim.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# REJECT claim
@progress_claim_bp.route('/progress-claims/<int:id>/reject', methods=['POST'])
def reject_claim(id):
    try:
        data = request.get_json() or {}
        claim = ProgressClaim.query.get_or_404(id)
        if claim.status not in ('draft', 'submitted'):
            return jsonify({'error': 'Claim cannot be rejected in its current state'}), 400
        claim.status = 'rejected'
        claim.approved_by = data.get('approvedBy', 'Manager')
        claim.approved_at = datetime.utcnow()
        claim.rejection_reason = data.get('rejectionReason', 'Rejected')
        db.session.commit()
        return jsonify({'success': True, 'claim': claim.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# DELETE claim (only draft)
@progress_claim_bp.route('/progress-claims/<int:id>', methods=['DELETE'])
def delete_claim(id):
    try:
        claim = ProgressClaim.query.get_or_404(id)
        if claim.status != 'draft':
            return jsonify({'error': 'Only draft claims can be deleted'}), 400
        db.session.delete(claim)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
