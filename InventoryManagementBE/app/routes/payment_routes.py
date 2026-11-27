# app/routes/payment_tracking_routes.py
from flask import Blueprint, request, jsonify, session, send_from_directory, current_app, make_response
from app import db
from app.models.supplier import Supplier
from app.models.supplier import Item
from app.models.payment import SupplierPayment
from app.models.expense import Expense, ExpensePartialPayment, ensure_expense_schema
from datetime import datetime, date, timedelta
import logging
import traceback
import os
import uuid
from werkzeug.utils import secure_filename
from sqlalchemy import func, or_, and_

payment_tracking_bp = Blueprint('payment_tracking', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)

# File upload configuration for expense receipts/bills
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(os.path.dirname(BASE_DIR), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'pdf', 'doc', 'docx', 'xlsx', 'xls', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==================== Supplier Payment Tracking Routes ====================

@payment_tracking_bp.route('/suppliers-with-items', methods=['GET'])
def get_suppliers_with_items():
    """Get all suppliers with their items and payment information"""
    try:
        # Get all suppliers
        suppliers = Supplier.query.order_by(Supplier.name).all()
        
        if not suppliers:
            return jsonify({
                'success': True,
                'suppliers': []
            }), 200
        
        suppliers_data = []
        for supplier in suppliers:
            # Get items for this supplier
            items = Item.query.filter_by(supplier_id=supplier.id).order_by(Item.created_at.desc()).all()
            
            suppliers_data.append({
                'id': supplier.id,
                'name': supplier.name,
                'company': supplier.company,
                'email': supplier.email,
                'phone': supplier.phone,
                'address': supplier.address,
                'created_at': supplier.created_at.isoformat() if supplier.created_at else None,
                'items': [{
                    'id': item.id,
                    'name': item.name,
                    'model': item.model,
                    'type': item.type,
                    'quantity': item.quantity,
                    'buy_price': item.buy_price,
                    'status': item.status,
                    'created_at': item.created_at.isoformat() if item.created_at else None
                } for item in items]
            })
        
        return jsonify({
            'success': True,
            'suppliers': suppliers_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching suppliers with items: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Failed to fetch suppliers'
        }), 500


@payment_tracking_bp.route('/suppliers/<int:supplier_id>/payments', methods=['GET'])
def get_supplier_payments(supplier_id):
    """Get all payments for a specific supplier"""
    try:
        # Check if supplier exists
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({
                'success': False,
                'error': 'Supplier not found'
            }), 404
        
        # Get all payments for this supplier
        payments = SupplierPayment.query.filter_by(supplier_id=supplier_id)\
            .order_by(SupplierPayment.payment_date.desc()).all()
        
        return jsonify({
            'success': True,
            'payments': [{
                'id': payment.id,
                'supplier_id': payment.supplier_id,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'notes': payment.notes,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
                'created_at': payment.created_at.isoformat() if payment.created_at else None
            } for payment in payments]
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching supplier payments: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch payments'
        }), 500


@payment_tracking_bp.route('/suppliers/<int:supplier_id>/payments', methods=['POST'])
def create_payment(supplier_id):
    """Create a new payment record for a supplier"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('amount'):
            return jsonify({
                'success': False,
                'error': 'Amount is required'
            }), 400
        
        # Check if supplier exists
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({
                'success': False,
                'error': 'Supplier not found'
            }), 404
        
        # Validate amount is positive
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({
                'success': False,
                'error': 'Amount must be greater than 0'
            }), 400
        
        # Create new payment
        payment = SupplierPayment(
            supplier_id=supplier_id,
            amount=amount,
            payment_method=data.get('payment_method', 'Cash'),
            reference_number=data.get('reference_number'),
            notes=data.get('notes'),
            payment_date=datetime.utcnow()
        )
        
        db.session.add(payment)
        db.session.commit()
        
        logger.info(f"Payment of {amount} recorded for supplier {supplier_id}")
        
        return jsonify({
            'success': True,
            'message': 'Payment recorded successfully',
            'payment': {
                'id': payment.id,
                'supplier_id': payment.supplier_id,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'notes': payment.notes,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
            }
        }), 201
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Invalid amount value'
        }), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating payment: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Failed to record payment'
        }), 500


@payment_tracking_bp.route('/payments/<int:payment_id>', methods=['DELETE'])
def delete_payment(payment_id):
    """Delete a payment record"""
    try:
        payment = SupplierPayment.query.get(payment_id)
        if not payment:
            return jsonify({
                'success': False,
                'error': 'Payment record not found'
            }), 404
        
        # Store supplier_id for logging
        supplier_id = payment.supplier_id
        amount = payment.amount
        
        db.session.delete(payment)
        db.session.commit()
        
        logger.info(f"Payment of {amount} deleted for supplier {supplier_id}")
        
        return jsonify({
            'success': True,
            'message': 'Payment deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting payment: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete payment'
        }), 500


@payment_tracking_bp.route('/payments/<int:payment_id>', methods=['PUT'])
def update_payment(payment_id):
    """Update a payment record"""
    try:
        payment = SupplierPayment.query.get(payment_id)
        if not payment:
            return jsonify({
                'success': False,
                'error': 'Payment record not found'
            }), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'amount' in data:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({
                    'success': False,
                    'error': 'Amount must be greater than 0'
                }), 400
            payment.amount = amount
        
        if 'payment_method' in data:
            payment.payment_method = data['payment_method']
        
        if 'reference_number' in data:
            payment.reference_number = data['reference_number']
        
        if 'notes' in data:
            payment.notes = data['notes']
        
        payment.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Payment {payment_id} updated for supplier {payment.supplier_id}")
        
        return jsonify({
            'success': True,
            'message': 'Payment updated successfully',
            'payment': {
                'id': payment.id,
                'supplier_id': payment.supplier_id,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'notes': payment.notes,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
            }
        }), 200
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Invalid amount value'
        }), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating payment: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update payment'
        }), 500


@payment_tracking_bp.route('/suppliers/<int:supplier_id>/payment-summary', methods=['GET'])
def get_supplier_payment_summary(supplier_id):
    """Get payment summary for a specific supplier"""
    try:
        # Check if supplier exists
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({
                'success': False,
                'error': 'Supplier not found'
            }), 404
        
        # Get all items for this supplier
        items = Item.query.filter_by(supplier_id=supplier_id).all()
        
        # Calculate total purchase amount (quantity × buy_price)
        total_purchase = sum((item.quantity or 0) * (item.buy_price or 0) for item in items)
        
        # Get all payments
        payments = SupplierPayment.query.filter_by(supplier_id=supplier_id).all()
        total_paid = sum(payment.amount for payment in payments)
        
        remaining_balance = total_purchase - total_paid
        
        # Determine payment status
        if remaining_balance <= 0:
            payment_status = 'Paid'
        elif total_paid > 0:
            payment_status = 'Pending'
        else:
            payment_status = 'Unpaid'
        
        return jsonify({
            'success': True,
            'summary': {
                'supplier_id': supplier_id,
                'supplier_name': supplier.name,
                'supplier_company': supplier.company,
                'total_purchase': float(total_purchase),
                'total_paid': float(total_paid),
                'remaining_balance': float(remaining_balance),
                'payment_status': payment_status,
                'items_count': len(items),
                'payments_count': len(payments)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching payment summary: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch payment summary'
        }), 500


@payment_tracking_bp.route('/payment-analytics/overview', methods=['GET'])
def get_payment_analytics():
    """Get overall payment analytics"""
    try:
        # Get all suppliers
        suppliers = Supplier.query.all()
        
        total_suppliers = len(suppliers)
        total_purchase = 0
        total_paid = 0
        
        # Calculate totals
        for supplier in suppliers:
            items = Item.query.filter_by(supplier_id=supplier.id).all()
            total_purchase += sum((item.quantity or 0) * (item.buy_price or 0) for item in items)
            
            payments = SupplierPayment.query.filter_by(supplier_id=supplier.id).all()
            total_paid += sum(payment.amount for payment in payments)
        
        remaining_balance = total_purchase - total_paid
        
        # Get payment method distribution
        payment_methods = db.session.query(
            SupplierPayment.payment_method,
            db.func.count(SupplierPayment.id).label('count'),
            db.func.sum(SupplierPayment.amount).label('total_amount')
        ).group_by(SupplierPayment.payment_method).all()
        
        # Get monthly payment trends (last 6 months)
        from sqlalchemy import func, extract
        monthly_trends = db.session.query(
            func.date_format(SupplierPayment.payment_date, '%Y-%m').label('month'),
            func.sum(SupplierPayment.amount).label('total_amount'),
            func.count(SupplierPayment.id).label('payment_count')
        ).filter(
            SupplierPayment.payment_date >= datetime.utcnow().replace(day=1)
        ).group_by('month').order_by('month').limit(6).all()
        
        return jsonify({
            'success': True,
            'analytics': {
                'total_suppliers': total_suppliers,
                'total_purchase': float(total_purchase),
                'total_paid': float(total_paid),
                'remaining_balance': float(remaining_balance),
                'payment_methods': [{
                    'method': pm[0],
                    'count': pm[1],
                    'total_amount': float(pm[2]) if pm[2] else 0
                } for pm in payment_methods],
                'monthly_trends': [{
                    'month': mt[0],
                    'total_amount': float(mt[1]) if mt[1] else 0,
                    'payment_count': mt[2]
                } for mt in monthly_trends]
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching payment analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Failed to fetch analytics'
        }), 500


@payment_tracking_bp.route('/payments/search', methods=['GET'])
def search_payments():
    """Search payments by reference number, supplier name, or date range"""
    try:
        query = request.args.get('q', '')
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        payments_query = SupplierPayment.query.join(Supplier)
        
        # Search by reference number or supplier name
        if query:
            payments_query = payments_query.filter(
                db.or_(
                    SupplierPayment.reference_number.ilike(f'%{query}%'),
                    Supplier.name.ilike(f'%{query}%'),
                    Supplier.company.ilike(f'%{query}%')
                )
            )
        
        # Filter by date range
        if from_date:
            from_datetime = datetime.strptime(from_date, '%Y-%m-%d')
            payments_query = payments_query.filter(SupplierPayment.payment_date >= from_datetime)
        
        if to_date:
            to_datetime = datetime.strptime(to_date, '%Y-%m-%d')
            to_datetime = to_datetime.replace(hour=23, minute=59, second=59)
            payments_query = payments_query.filter(SupplierPayment.payment_date <= to_datetime)
        
        # Order by most recent first
        payments = payments_query.order_by(SupplierPayment.payment_date.desc()).limit(50).all()
        
        return jsonify({
            'success': True,
            'payments': [{
                'id': payment.id,
                'supplier_id': payment.supplier_id,
                'supplier_name': payment.supplier.name,
                'supplier_company': payment.supplier.company,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'notes': payment.notes,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
            } for payment in payments]
        }), 200
        
    except Exception as e:
        logger.error(f"Error searching payments: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to search payments'
        }), 500


@payment_tracking_bp.route('/suppliers/<int:supplier_id>/payment-history', methods=['GET'])
def get_payment_history(supplier_id):
    """Get paginated payment history for a supplier"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Check if supplier exists
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({
                'success': False,
                'error': 'Supplier not found'
            }), 404
        
        # Get paginated payments
        paginated_payments = SupplierPayment.query.filter_by(supplier_id=supplier_id)\
            .order_by(SupplierPayment.payment_date.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'success': True,
            'payments': [{
                'id': payment.id,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'notes': payment.notes,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
            } for payment in paginated_payments.items],
            'total': paginated_payments.total,
            'pages': paginated_payments.pages,
            'current_page': paginated_payments.page
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching payment history: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch payment history'
        }), 500


# ==================== Manual Expense Entry & Tracking Routes ====================

DEFAULT_EXPENSE_CATEGORIES = [
    "Office Supplies",
    "Food & Refreshments",
    "Travel & Transport",
    "Utilities & Bills",
    "Maintenance & Repairs",
    "Fuel & Vehicle",
    "Tools & Hardware",
    "Miscellaneous"
]

@payment_tracking_bp.route('/expenses/categories', methods=['GET'])
def get_expense_categories():
    """Get list of distinct expense/payment categories recorded in the system"""
    try:
        custom_cats = db.session.query(Expense.category).distinct().filter(Expense.category != None).all()
        cats_set = set(DEFAULT_EXPENSE_CATEGORIES)
        for (c,) in custom_cats:
            if c and c.strip():
                cats_set.add(c.strip())
        
        sorted_cats = [c for c in DEFAULT_EXPENSE_CATEGORIES if c in cats_set]
        extra_cats = sorted([c for c in cats_set if c not in DEFAULT_EXPENSE_CATEGORIES])
        
        return jsonify({
            'success': True,
            'categories': sorted_cats + extra_cats
        }), 200
    except Exception as e:
        logger.error(f"Error fetching expense categories: {str(e)}")
        return jsonify({
            'success': True,
            'categories': DEFAULT_EXPENSE_CATEGORIES
        }), 200


@payment_tracking_bp.route('/expenses/reminders', methods=['GET'])
def get_payment_reminders():
    """
    Get payment reminders and alerts:
    - Overdue payments: due_date < today and pending_amount > 0
    - Due today: due_date == today and pending_amount > 0
    - Upcoming payments: due_date > today and pending_amount > 0 (within next 30 days)
    Includes:
      Payment Category, Payment Description, Total Amount, Due Date, Pending Amount
    """
    try:
        today = date.today()
        # Fetch all unpaid/partially paid expenses that have a due date
        all_expenses = Expense.query.filter(Expense.due_date != None).all()

        overdue_list = []
        due_today_list = []
        upcoming_list = []

        overdue_pending = 0.0
        due_today_pending = 0.0
        upcoming_pending = 0.0

        for exp in all_expenses:
            # Skip if fully paid
            if exp.payment_status == 'Paid' or exp.remaining_amount <= 0:
                continue

            item_data = {
                'id': exp.id,
                'category': exp.category or 'General',
                'description': exp.description,
                'total_amount': float(exp.amount or 0.0),
                'total_paid': exp.total_paid,
                'pending_amount': exp.remaining_amount,
                'remaining_amount': exp.remaining_amount,
                'due_date': exp.due_date.strftime('%Y-%m-%d') if exp.due_date else None,
                'expense_date': exp.expense_date.strftime('%Y-%m-%d') if exp.expense_date else None,
                'payment_status': exp.payment_status,
                'due_status': exp.due_status,
                'days_until_due': exp.days_until_due,
                'reference_number': exp.reference_number,
                'bill_attachment': exp.bill_attachment,
                'last_payment_date': exp.last_payment_date.strftime('%Y-%m-%d') if exp.last_payment_date else None
            }

            if exp.due_date < today:
                overdue_list.append(item_data)
                overdue_pending += exp.remaining_amount
            elif exp.due_date == today:
                due_today_list.append(item_data)
                due_today_pending += exp.remaining_amount
            else:
                upcoming_list.append(item_data)
                upcoming_pending += exp.remaining_amount

        # Sort: Overdue oldest due date first, Upcoming nearest due date first
        overdue_list.sort(key=lambda x: x['due_date'])
        upcoming_list.sort(key=lambda x: x['due_date'])

        return jsonify({
            'success': True,
            'reminders': {
                'overdue': overdue_list,
                'due_today': due_today_list,
                'upcoming': upcoming_list
            },
            'stats': {
                'overdue_count': len(overdue_list),
                'overdue_pending': round(overdue_pending, 2),
                'due_today_count': len(due_today_list),
                'due_today_pending': round(due_today_pending, 2),
                'upcoming_count': len(upcoming_list),
                'upcoming_pending': round(upcoming_pending, 2),
                'total_attention_count': len(overdue_list) + len(due_today_list) + len(upcoming_list),
                'total_attention_pending': round(overdue_pending + due_today_pending + upcoming_pending, 2),
                'current_date': today.strftime('%Y-%m-%d')
            }
        }), 200

    except Exception as e:
        logger.error(f"Error fetching payment reminders: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to fetch reminders: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses', methods=['GET'])
def get_expenses():
    """
    Get payment/expense entries with comprehensive filtering:
    - filter_type: 'all' | 'daily' | 'monthly' | 'custom'
    - date: specific date 'YYYY-MM-DD' for daily filter
    - month: specific month 'YYYY-MM' for monthly filter
    - from_date / to_date: for custom date range
    - status: 'all' | 'pending' | 'partially_paid' | 'paid' | 'overdue'
    - due_status: 'all' | 'overdue' | 'due_today' | 'upcoming'
    - category: manual category string filter
    - payment_method: payment mode filter
    - search: keyword search in description, category, reference_number, notes
    - page, limit: pagination
    """
    try:
        filter_type = request.args.get('filter_type', 'all').lower()
        selected_date = request.args.get('date')
        selected_month = request.args.get('month')
        from_date = request.args.get('from_date') or request.args.get('start_date')
        to_date = request.args.get('to_date') or request.args.get('end_date')
        category = request.args.get('category')
        payment_method = request.args.get('payment_method')
        status_filter = request.args.get('status', 'all').lower()
        due_status_filter = request.args.get('due_status', 'all').lower()
        search = request.args.get('search', '').strip()

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 0, type=int)

        query = Expense.query

        # 1. Date / Period Filters (based on expense_date or due_date)
        if filter_type == 'daily':
            if selected_date:
                try:
                    d = datetime.strptime(selected_date, '%Y-%m-%d').date()
                    query = query.filter(or_(Expense.expense_date == d, Expense.due_date == d))
                except ValueError:
                    pass
            else:
                today = date.today()
                query = query.filter(or_(Expense.expense_date == today, Expense.due_date == today))

        elif filter_type == 'monthly':
            if selected_month:
                try:
                    parts = selected_month.split('-')
                    y = int(parts[0])
                    m = int(parts[1])
                    start_d = date(y, m, 1)
                    if m == 12:
                        end_d = date(y + 1, 1, 1) - timedelta(days=1)
                    else:
                        end_d = date(y, m + 1, 1) - timedelta(days=1)
                    query = query.filter(
                        or_(
                            and_(Expense.expense_date >= start_d, Expense.expense_date <= end_d),
                            and_(Expense.due_date >= start_d, Expense.due_date <= end_d)
                        )
                    )
                except Exception:
                    pass
            else:
                today = date.today()
                start_d = date(today.year, today.month, 1)
                if today.month == 12:
                    end_d = date(today.year + 1, 1, 1) - timedelta(days=1)
                else:
                    end_d = date(today.year, today.month + 1, 1) - timedelta(days=1)
                query = query.filter(
                    or_(
                        and_(Expense.expense_date >= start_d, Expense.expense_date <= end_d),
                        and_(Expense.due_date >= start_d, Expense.due_date <= end_d)
                    )
                )

        elif filter_type == 'custom':
            if from_date:
                try:
                    fd = datetime.strptime(from_date, '%Y-%m-%d').date()
                    query = query.filter(or_(Expense.expense_date >= fd, Expense.due_date >= fd))
                except ValueError:
                    pass
            if to_date:
                try:
                    td = datetime.strptime(to_date, '%Y-%m-%d').date()
                    query = query.filter(or_(Expense.expense_date <= td, Expense.due_date <= td))
                except ValueError:
                    pass

        # 2. Category Filter (exact or substring)
        if category and category.lower() != 'all':
            query = query.filter(Expense.category.ilike(f"%{category.strip()}%"))

        # 3. Payment Method Filter
        if payment_method and payment_method.lower() != 'all':
            query = query.filter(Expense.payment_method == payment_method)

        # 4. Search Filter
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Expense.description.ilike(search_pattern),
                    Expense.notes.ilike(search_pattern),
                    Expense.category.ilike(search_pattern),
                    Expense.payment_method.ilike(search_pattern),
                    Expense.reference_number.ilike(search_pattern)
                )
            )

        # Order by expense_date descending, then id descending
        all_results = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()

        # 5. Apply Status and Due Status filtering in Python for 100% calculation accuracy
        filtered_items = []
        for exp in all_results:
            p_status = exp.payment_status.lower().replace(" ", "_")
            d_status = exp.due_status.lower().replace(" ", "_")

            if status_filter != 'all':
                if status_filter == 'pending' and p_status != 'pending':
                    continue
                elif status_filter in ['partially_paid', 'partiallypaid', 'partial'] and p_status != 'partially_paid':
                    continue
                elif status_filter == 'paid' and p_status != 'paid':
                    continue
                elif status_filter == 'overdue' and p_status != 'overdue':
                    continue

            if due_status_filter != 'all':
                if due_status_filter == 'overdue' and d_status != 'overdue':
                    continue
                elif due_status_filter in ['due_today', 'duetoday', 'today'] and d_status != 'due_today':
                    continue
                elif due_status_filter == 'upcoming' and d_status != 'upcoming':
                    continue

            filtered_items.append(exp)

        # Totals for filtered items
        total_amount = sum(float(e.amount or 0.0) for e in filtered_items)
        total_paid = sum(e.total_paid for e in filtered_items)
        total_pending = sum(e.remaining_amount for e in filtered_items)
        total_count = len(filtered_items)

        # Handle pagination
        if limit and limit > 0:
            total_pages = max(1, (total_count + limit - 1) // limit)
            offset = (page - 1) * limit
            paginated = filtered_items[offset:offset + limit]
            expense_list = [e.to_dict() for e in paginated]
            return jsonify({
                'success': True,
                'expenses': expense_list,
                'total_count': total_count,
                'total_amount': round(total_amount, 2),
                'total_paid': round(total_paid, 2),
                'total_pending': round(total_pending, 2),
                'page': page,
                'pages': total_pages,
                'limit': limit
            }), 200
        else:
            expense_list = [e.to_dict() for e in filtered_items]
            return jsonify({
                'success': True,
                'expenses': expense_list,
                'total_count': total_count,
                'total_amount': round(total_amount, 2),
                'total_paid': round(total_paid, 2),
                'total_pending': round(total_pending, 2)
            }), 200

    except Exception as e:
        logger.error(f"Error fetching expenses: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to fetch expenses: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses/summary', methods=['GET'])
def get_expenses_summary():
    """
    Get aggregated expense and payment summaries:
    - Total committed amount
    - Total amount paid
    - Remaining pending balance
    - Overdue total amount and count
    - Due today count and pending amount
    - Upcoming count and pending amount
    - Category-wise breakdown with total, paid, remaining, count, percentage
    """
    try:
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        if today.month == 12:
            end_of_month = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_of_month = date(today.year, today.month + 1, 1) - timedelta(days=1)

        all_expenses = Expense.query.all()

        total_committed = 0.0
        total_paid = 0.0
        total_pending = 0.0

        today_paid_total = 0.0
        month_paid_total = 0.0

        overdue_total = 0.0
        overdue_count = 0

        due_today_total = 0.0
        due_today_count = 0

        upcoming_total = 0.0
        upcoming_count = 0

        paid_count = 0
        partially_paid_count = 0
        pending_count = 0

        category_totals = {}
        category_paid = {}
        category_pending = {}
        category_counts = {}

        for exp in all_expenses:
            amt = float(exp.amount or 0.0)
            paid = exp.total_paid
            rem = exp.remaining_amount
            status = exp.payment_status

            total_committed += amt
            total_paid += paid
            total_pending += rem

            # Status counts
            if status == 'Paid':
                paid_count += 1
            elif status == 'Partially Paid':
                partially_paid_count += 1
            elif status == 'Overdue':
                overdue_count += 1
                overdue_total += rem
            else:
                pending_count += 1

            # Due date categorization
            if exp.due_date and rem > 0:
                if exp.due_date < today:
                    # Already handled in overdue
                    pass
                elif exp.due_date == today:
                    due_today_count += 1
                    due_today_total += rem
                else:
                    upcoming_count += 1
                    upcoming_total += rem

            # Category aggregation
            cat = (exp.category or 'General').strip()
            category_totals[cat] = category_totals.get(cat, 0.0) + amt
            category_paid[cat] = category_paid.get(cat, 0.0) + paid
            category_pending[cat] = category_pending.get(cat, 0.0) + rem
            category_counts[cat] = category_counts.get(cat, 0) + 1

            # Check partial payments dates for today/month paid metrics
            for p in exp.partial_payments:
                p_amt = float(p.amount_paid or 0.0)
                if p.payment_date == today:
                    today_paid_total += p_amt
                if p.payment_date and start_of_month <= p.payment_date <= end_of_month:
                    month_paid_total += p_amt

        # Format category summary
        category_summary = []
        for cat, tot in category_totals.items():
            pct = (tot / total_committed * 100.0) if total_committed > 0 else 0.0
            category_summary.append({
                'category': cat,
                'total': round(tot, 2),
                'paid': round(category_paid.get(cat, 0.0), 2),
                'remaining': round(category_pending.get(cat, 0.0), 2),
                'count': category_counts.get(cat, 0),
                'percentage': round(pct, 1)
            })
        category_summary.sort(key=lambda x: x['total'], reverse=True)

        return jsonify({
            'success': True,
            'summary': {
                'total_committed': round(total_committed, 2),
                'total_amount': round(total_committed, 2),  # alias
                'overall_total': round(total_committed, 2), # alias
                'total_paid': round(total_paid, 2),
                'total_pending': round(total_pending, 2),
                'overdue_total': round(overdue_total, 2),
                'overdue_count': overdue_count,
                'due_today_total': round(due_today_total, 2),
                'due_today_count': due_today_count,
                'upcoming_total': round(upcoming_total, 2),
                'upcoming_count': upcoming_count,
                'paid_count': paid_count,
                'partially_paid_count': partially_paid_count,
                'pending_count': pending_count,
                'overall_count': len(all_expenses),
                'today_paid_total': round(today_paid_total, 2),
                'month_paid_total': round(month_paid_total, 2),
                'category_summary': category_summary,
                'current_date': today.strftime('%Y-%m-%d'),
                'current_month': today.strftime('%Y-%m')
            }
        }), 200

    except Exception as e:
        logger.error(f"Error calculating expense summary: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to calculate expense summary: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses', methods=['POST'])
def create_expense():
    """
    Manually add an expense/payment entry.
    Supports:
    - Manual category entry
    - Due date selection
    - Total amount
    - Description, Reference number, Notes
    - File upload (bills/receipts/proof)
    - Optional initial payment (None, Partial, or Full)
    """
    try:
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            file = request.files.get('file') or request.files.get('bill_file') or request.files.get('bill')
        else:
            data = request.get_json(silent=True) or {}
            file = None

        description = data.get('description', '').strip()
        amount_raw = data.get('amount') or data.get('total_amount')

        if not description:
            return jsonify({
                'success': False,
                'error': 'Payment description is required'
            }), 400

        if amount_raw is None or str(amount_raw).strip() == '':
            return jsonify({
                'success': False,
                'error': 'Total amount is required'
            }), 400

        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({
                    'success': False,
                    'error': 'Total amount must be greater than 0'
                }), 400
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Invalid amount number'
            }), 400

        # Expense / Created date
        date_str = data.get('date') or data.get('expense_date')
        if date_str:
            try:
                expense_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                expense_date = date.today()
        else:
            expense_date = date.today()

        # Due Date
        due_date_str = data.get('due_date')
        due_date = None
        if due_date_str and due_date_str.strip():
            try:
                due_date = datetime.strptime(due_date_str.strip(), '%Y-%m-%d').date()
            except ValueError:
                due_date = None

        # Category: Manual text entry
        category = data.get('category', '').strip()
        if not category:
            category = 'General'

        payment_method = data.get('payment_method', 'Cash').strip() or 'Cash'
        reference_number = data.get('reference_number', '').strip() or None
        notes = data.get('notes', '').strip() or None

        # Bill attachment handling
        bill_attachment = None
        bill_original_name = None

        if file and file.filename:
            if allowed_file(file.filename):
                original_name = secure_filename(file.filename)
                unique_name = f"expense_{uuid.uuid4().hex[:10]}_{original_name}"
                save_path = os.path.join(UPLOAD_FOLDER, unique_name)
                file.save(save_path)
                bill_attachment = unique_name
                bill_original_name = file.filename
            else:
                return jsonify({
                    'success': False,
                    'error': 'Invalid file format. Allowed: PNG, JPG, JPEG, WEBP, PDF, DOC, DOCX, XLSX, TXT'
                }), 400
        elif data.get('bill_attachment'):
            bill_attachment = data.get('bill_attachment')
            bill_original_name = data.get('bill_original_name') or bill_attachment

        new_expense = Expense(
            description=description,
            amount=amount,
            expense_date=expense_date,
            due_date=due_date,
            category=category,
            payment_method=payment_method,
            reference_number=reference_number,
            bill_attachment=bill_attachment,
            bill_original_name=bill_original_name,
            notes=notes
        )

        db.session.add(new_expense)
        db.session.flush()  # assign new_expense.id

        # Check for initial partial/full payment
        initial_status = data.get('initial_payment_status', '').lower()
        initial_amount_raw = data.get('initial_paid_amount')

        initial_paid = 0.0
        if initial_status == 'full':
            initial_paid = amount
        elif initial_amount_raw:
            try:
                initial_paid = float(initial_amount_raw)
            except ValueError:
                initial_paid = 0.0

        if initial_paid > 0:
            init_mode = data.get('initial_payment_mode') or payment_method or 'Cash'
            init_date_str = data.get('initial_payment_date') or date_str
            try:
                init_date = datetime.strptime(init_date_str, '%Y-%m-%d').date() if init_date_str else date.today()
            except ValueError:
                init_date = date.today()
            init_remarks = data.get('initial_remarks') or ('Full payment' if initial_paid >= amount else 'Initial partial payment')

            first_payment = ExpensePartialPayment(
                expense_id=new_expense.id,
                amount_paid=min(initial_paid, amount),
                payment_date=init_date,
                payment_mode=init_mode,
                remarks=init_remarks
            )
            db.session.add(first_payment)

        db.session.commit()
        logger.info(f"Created Expense ID {new_expense.id}: '{description}' Total: ${amount}, Initial Paid: ${initial_paid}")

        return jsonify({
            'success': True,
            'message': 'Payment entry recorded successfully',
            'expense': new_expense.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating expense: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to record payment entry: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses/<int:expense_id>', methods=['GET'])
def get_single_expense(expense_id):
    """Get single payment entry with all partial payments"""
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({
                'success': False,
                'error': 'Payment entry not found'
            }), 404

        return jsonify({
            'success': True,
            'expense': expense.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Error fetching expense {expense_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch payment entry'
        }), 500


@payment_tracking_bp.route('/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    """
    Update an expense/payment entry:
    - description, amount, due_date, expense_date, category (manual entry),
      payment_method, reference_number, notes, bill attachment replacement/removal
    """
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({
                'success': False,
                'error': 'Payment record not found'
            }), 404

        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            file = request.files.get('file') or request.files.get('bill_file') or request.files.get('bill')
        else:
            data = request.get_json(silent=True) or {}
            file = None

        if 'description' in data:
            desc = data['description'].strip()
            if not desc:
                return jsonify({
                    'success': False,
                    'error': 'Description cannot be empty'
                }), 400
            expense.description = desc

        if 'amount' in data or 'total_amount' in data:
            amt_raw = data.get('amount') or data.get('total_amount')
            try:
                amt = float(amt_raw)
                if amt <= 0:
                    return jsonify({
                        'success': False,
                        'error': 'Amount must be greater than 0'
                    }), 400
                expense.amount = amt
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid amount value'
                }), 400

        if 'date' in data or 'expense_date' in data:
            date_str = data.get('date') or data.get('expense_date')
            try:
                expense.expense_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except Exception:
                pass

        if 'due_date' in data:
            due_str = data.get('due_date')
            if due_str and str(due_str).strip():
                try:
                    expense.due_date = datetime.strptime(due_str.strip(), '%Y-%m-%d').date()
                except Exception:
                    pass
            else:
                expense.due_date = None

        if 'category' in data:
            cat = data['category'].strip()
            expense.category = cat if cat else 'General'

        if 'payment_method' in data:
            expense.payment_method = data['payment_method'].strip() or 'Cash'

        if 'reference_number' in data:
            expense.reference_number = data['reference_number'].strip() or None

        if 'notes' in data:
            expense.notes = data['notes'].strip() or None

        # Bill removal flag
        remove_bill = data.get('remove_bill') in [True, 'true', '1', 1]
        if remove_bill and expense.bill_attachment:
            old_path = os.path.join(UPLOAD_FOLDER, expense.bill_attachment)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass
            expense.bill_attachment = None
            expense.bill_original_name = None

        # New bill file
        if file and file.filename:
            if allowed_file(file.filename):
                if expense.bill_attachment:
                    old_path = os.path.join(UPLOAD_FOLDER, expense.bill_attachment)
                    if os.path.exists(old_path):
                        try:
                            os.remove(old_path)
                        except Exception:
                            pass

                original_name = secure_filename(file.filename)
                unique_name = f"expense_{uuid.uuid4().hex[:10]}_{original_name}"
                save_path = os.path.join(UPLOAD_FOLDER, unique_name)
                file.save(save_path)
                expense.bill_attachment = unique_name
                expense.bill_original_name = file.filename
            else:
                return jsonify({
                    'success': False,
                    'error': 'Invalid file format. Allowed: PNG, JPG, JPEG, WEBP, PDF, DOC, DOCX, XLSX, TXT'
                }), 400

        expense.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Updated expense ID {expense.id}")

        return jsonify({
            'success': True,
            'message': 'Payment entry updated successfully',
            'expense': expense.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating expense {expense_id}: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to update payment entry: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """Delete an expense record, its partial payments, and attached bill file"""
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({
                'success': False,
                'error': 'Payment entry not found'
            }), 404

        if expense.bill_attachment:
            file_path = os.path.join(UPLOAD_FOLDER, expense.bill_attachment)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as file_err:
                    logger.warning(f"Failed to remove bill file: {file_err}")

        db.session.delete(expense)
        db.session.commit()

        logger.info(f"Deleted expense ID {expense_id}")

        return jsonify({
            'success': True,
            'message': 'Payment entry deleted successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting expense {expense_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete payment entry'
        }), 500


# ==========================================
# PARTIAL PAYMENT TRACKING ROUTES
# ==========================================

@payment_tracking_bp.route('/expenses/<int:expense_id>/payments', methods=['GET'])
def get_expense_partial_payments(expense_id):
    """Get all partial payments recorded for an expense"""
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({
                'success': False,
                'error': 'Payment entry not found'
            }), 404

        payments = ExpensePartialPayment.query.filter_by(expense_id=expense_id)\
            .order_by(ExpensePartialPayment.payment_date.desc(), ExpensePartialPayment.id.desc()).all()

        return jsonify({
            'success': True,
            'expense_id': expense_id,
            'total_amount': float(expense.amount or 0.0),
            'total_paid': expense.total_paid,
            'remaining_amount': expense.remaining_amount,
            'payment_status': expense.payment_status,
            'payments': [p.to_dict() for p in payments]
        }), 200

    except Exception as e:
        logger.error(f"Error fetching partial payments for expense {expense_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch partial payments'
        }), 500


@payment_tracking_bp.route('/expenses/<int:expense_id>/payments', methods=['POST'])
def add_expense_partial_payment(expense_id):
    """
    Record a partial or full payment against a payment entry:
    - amount_paid (required > 0)
    - payment_date (defaults to today)
    - payment_mode (Cash, PayNow, Bank Transfer, Cheque, Credit Card, NETS, etc.)
    - remarks (optional)
    """
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({
                'success': False,
                'error': 'Payment entry not found'
            }), 404

        data = request.get_json(silent=True) or {}
        amount_raw = data.get('amount_paid') or data.get('amount')

        if amount_raw is None or str(amount_raw).strip() == '':
            return jsonify({
                'success': False,
                'error': 'Amount paid is required'
            }), 400

        try:
            amount_paid = float(amount_raw)
            if amount_paid <= 0:
                return jsonify({
                    'success': False,
                    'error': 'Amount paid must be greater than 0'
                }), 400
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Invalid payment amount'
            }), 400

        # Payment date
        p_date_str = data.get('payment_date') or data.get('date')
        if p_date_str:
            try:
                payment_date = datetime.strptime(p_date_str, '%Y-%m-%d').date()
            except ValueError:
                payment_date = date.today()
        else:
            payment_date = date.today()

        payment_mode = data.get('payment_mode') or data.get('payment_method') or 'Cash'
        remarks = data.get('remarks') or data.get('notes') or None

        partial_pay = ExpensePartialPayment(
            expense_id=expense_id,
            amount_paid=amount_paid,
            payment_date=payment_date,
            payment_mode=payment_mode,
            remarks=remarks
        )

        db.session.add(partial_pay)
        expense.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Recorded partial payment ID {partial_pay.id} (${amount_paid}) for Expense {expense_id}")

        return jsonify({
            'success': True,
            'message': 'Payment recorded successfully',
            'payment': partial_pay.to_dict(),
            'expense': expense.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding partial payment for expense {expense_id}: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to record payment: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses/<int:expense_id>/payments/<int:payment_id>', methods=['DELETE'])
def delete_expense_partial_payment(expense_id, payment_id):
    """Delete a partial payment and recalculate balance"""
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({
                'success': False,
                'error': 'Payment entry not found'
            }), 404

        payment = ExpensePartialPayment.query.filter_by(id=payment_id, expense_id=expense_id).first()
        if not payment:
            return jsonify({
                'success': False,
                'error': 'Partial payment record not found'
            }), 404

        db.session.delete(payment)
        expense.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Deleted partial payment ID {payment_id} from expense {expense_id}")

        return jsonify({
            'success': True,
            'message': 'Payment record deleted successfully',
            'expense': expense.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting partial payment {payment_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete payment record'
        }), 500


@payment_tracking_bp.route('/expenses/upload-bill', methods=['POST'])
def upload_expense_bill():
    """
    Standalone endpoint to upload a bill, receipt, or payment proof document.
    Returns the uploaded filename and URL.
    """
    try:
        if 'file' not in request.files and 'bill_file' not in request.files and 'bill' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file uploaded'
            }), 400

        file = request.files.get('file') or request.files.get('bill_file') or request.files.get('bill')
        if not file or file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No selected file'
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': 'File format not supported. Allowed: PNG, JPG, JPEG, WEBP, PDF, DOC, DOCX, XLSX, TXT'
            }), 400

        original_name = secure_filename(file.filename)
        unique_name = f"expense_{uuid.uuid4().hex[:10]}_{original_name}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(save_path)

        return jsonify({
            'success': True,
            'message': 'Bill uploaded successfully',
            'filename': unique_name,
            'original_name': file.filename,
            'url': f"/uploads/{unique_name}"
        }), 200

    except Exception as e:
        logger.error(f"Error uploading bill file: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to upload file: {str(e)}'
        }), 500


@payment_tracking_bp.route('/expenses/bill/<filename>', methods=['GET'])
def get_expense_bill(filename):
    """Serve or download uploaded expense bill / receipt file"""
    try:
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Invalid filename'}), 400

        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'Bill attachment not found'}), 404

        as_download = request.args.get('download') in [True, 'true', '1', 1]
        return send_from_directory(
            UPLOAD_FOLDER,
            filename,
            as_attachment=as_download
        )
    except Exception as e:
        logger.error(f"Error serving expense bill {filename}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve bill file'}), 500
