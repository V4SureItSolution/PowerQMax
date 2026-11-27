# app/routes/attendance_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime, date
from sqlalchemy import and_, func
from app import db
from app.models import Attendance, Employee
import logging

from flask_cors import CORS

attendance_bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')
CORS(attendance_bp)
logger = logging.getLogger(__name__)


# ✅ Check In - Simple check-in without location/device
@attendance_bp.route('/check-in', methods=['POST'])
def check_in():
    """Employee check-in - Simple version"""
    try:
        data = request.get_json() or {}
        current_user_id = None
        
        logger.info(f"Check-in request data: {data}")
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            logger.info(f"JWT Identity: {current_user_id}")
        except:
            pass
        
        # Get employee by user_id, employee_id, or email
        employee = None
        if 'employee_id' in data:
            logger.info(f"Looking for employee by ID: {data['employee_id']}")
            employee = Employee.query.get(data['employee_id'])
        elif 'email' in data:
            logger.info(f"Looking for employee by email: {data['email']}")
            employee = Employee.query.filter_by(email=data['email']).first()
        elif current_user_id:
            logger.info(f"Looking for employee by user ID: {current_user_id}")
            employee = Employee.query.filter_by(id=current_user_id).first()
        
        if not employee:
            logger.error(f"Employee not found. Data: {data}, Current User ID: {current_user_id}")
            # Debug: return all employees for troubleshooting
            all_employees = Employee.query.all()
            return jsonify({
                'error': 'Employee not found. Please provide employee_id or email in request body.',
                'debug_employees_count': len(all_employees),
                'received_data': data
            }), 404
        
        today = date.today()
        
        # Check if already checked in today
        existing_attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if existing_attendance and existing_attendance.check_in_time:
            return jsonify({'error': 'Already checked in today'}), 400
        
        # Create or update attendance record
        if existing_attendance:
            attendance = existing_attendance
            attendance.check_in_time = datetime.now()
            attendance.status = 'present'
        else:
            attendance = Attendance(
                employee_id=employee.id,
                date=today,
                check_in_time=datetime.now(),
                status='present'
            )
            db.session.add(attendance)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Check-in successful',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Check-in error: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': f"Internal server error: {str(e)}"}), 500


# ✅ Check Out - Simple check-out without location/device
@attendance_bp.route('/check-out', methods=['PUT'])
def check_out():
    """Employee check-out - Simple version"""
    try:
        data = request.get_json() or {}
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        # Get employee
        employee = None
        if 'employee_id' in data:
            employee = Employee.query.get(data['employee_id'])
        elif 'email' in data:
            employee = Employee.query.filter_by(email=data['email']).first()
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        
        if not employee:
            return jsonify({'error': 'Employee not found. Please provide employee_id or email in request body.'}), 404
        
        today = date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if not attendance or not attendance.check_in_time:
            return jsonify({'error': 'No check-in record found for today'}), 404
        
        if attendance.check_out_time:
            return jsonify({'error': 'Already checked out today'}), 400
        
        # Set check-out time
        attendance.check_out_time = datetime.now()
        
        # Calculate total hours
        if attendance.check_in_time and attendance.check_out_time:
            time_diff = attendance.check_out_time - attendance.check_in_time
            attendance.total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            # Calculate overtime (assuming 8 hours standard workday)
            standard_hours = 8
            if attendance.total_hours > standard_hours:
                attendance.overtime = round(attendance.total_hours - standard_hours, 2)
        
        attendance.status = 'present'
        db.session.commit()
        
        return jsonify({
            'message': 'Check-out successful',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Check-out error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ✅ Get today's attendance for current user
@attendance_bp.route('/today', methods=['GET'])
def get_today_attendance():
    """Get today's attendance for current user"""
    try:
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee_id = request.args.get('employee_id')
        
        # Get employee
        if employee_id:
            employee = Employee.query.get(employee_id)
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        else:
            return jsonify({'error': 'Please provide employee_id as query parameter or JWT token'}), 400
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        today = date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if attendance:
            return jsonify(attendance.to_dict()), 200
        else:
            return jsonify({
                'employee_id': employee.id,
                'employee_name': getattr(employee, 'full_name', getattr(employee, 'name', '')),
                'date': today.isoformat(),
                'check_in_time': None,
                'check_out_time': None,
                'status': 'not_started',
                'total_hours': 0
            }), 200
            
    except Exception as e:
        logger.error(f"Get today's attendance error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get attendance history for current user
@attendance_bp.route('/history', methods=['GET'])
def get_attendance_history():
    """Get attendance history for current user"""
    try:
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee_id = request.args.get('employee_id')
        
        # Get employee
        if employee_id:
            employee = Employee.query.get(employee_id)
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        else:
            return jsonify({'error': 'Please provide employee_id as query parameter or JWT token'}), 400
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        # Get query parameters for filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 30, type=int)
        
        query = Attendance.query.filter(Attendance.employee_id == employee.id)
        
        # Apply filters
        if start_date:
            query = query.filter(Attendance.date >= start_date)
        if end_date:
            query = query.filter(Attendance.date <= end_date)
        
        # Order by date descending and limit
        attendances = query.order_by(Attendance.date.desc()).limit(limit).all()
        
        # Calculate summary
        total_present = sum(1 for a in attendances if a.status == 'present')
        total_absent = sum(1 for a in attendances if a.status == 'absent')
        total_late = sum(1 for a in attendances if a.status == 'late')
        total_hours = sum(a.total_hours or 0 for a in attendances)
        total_overtime = sum(a.overtime or 0 for a in attendances)
        
        return jsonify({
            'attendances': [a.to_dict() for a in attendances],
            'summary': {
                'total_days': len(attendances),
                'present': total_present,
                'absent': total_absent,
                'late': total_late,
                'total_hours': round(total_hours, 2),
                'total_overtime': round(total_overtime, 2)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get attendance history error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get monthly summary for dashboard
@attendance_bp.route('/monthly-summary', methods=['GET'])
def get_monthly_summary():
    """Get monthly attendance summary"""
    try:
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee_id = request.args.get('employee_id')
        
        # Get employee
        if employee_id:
            employee = Employee.query.get(employee_id)
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        else:
            return jsonify({'error': 'Please provide employee_id as query parameter or JWT token'}), 400
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        year = request.args.get('year', datetime.now().year, type=int)
        month = request.args.get('month', datetime.now().month, type=int)
        
        # Get attendance for the month
        attendances = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                func.year(Attendance.date) == year,
                func.month(Attendance.date) == month
            )
        ).all()
        
        # Calculate statistics
        total_days = len(attendances)
        present_days = sum(1 for a in attendances if a.status == 'present')
        absent_days = sum(1 for a in attendances if a.status == 'absent')
        late_days = sum(1 for a in attendances if a.status == 'late')
        total_hours = sum(a.total_hours or 0 for a in attendances)
        
        return jsonify({
            'year': year,
            'month': month,
            'statistics': {
                'total_days': total_days,
                'present': present_days,
                'absent': absent_days,
                'late': late_days,
                'attendance_rate': round((present_days / total_days * 100) if total_days > 0 else 0, 2),
                'total_hours': round(total_hours, 2)
            },
            'attendances': [a.to_dict() for a in attendances]
        }), 200
        
    except Exception as e:
        logger.error(f"Get monthly summary error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get all employees for attendance tracking (Admin)
@attendance_bp.route('/employees', methods=['GET'])
def get_employees():
    """Get list of employees for attendance tracking"""
    try:
        employees = Employee.query.all()
        
        logger.info(f"Total employees in database: {len(employees)}")
        
        return jsonify({
            'total_employees': len(employees),
            'employees': [{
                'id': e.id,
                'employee_id': e.employee_id,
                'full_name': e.full_name,
                'email': e.email,
                'department': e.department,
                'designation': e.designation
            } for e in employees]
        }), 200
        
    except Exception as e:
        logger.error(f"Get employees error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Update attendance record (Admin only)
@attendance_bp.route('/update/<int:attendance_id>', methods=['PUT'])
def update_attendance(attendance_id):
    """Update attendance record (admin only)"""
    try:
        data = request.get_json()
        
        attendance = Attendance.query.get(attendance_id)
        if not attendance:
            return jsonify({'error': 'Attendance record not found'}), 404
        
        # Update fields
        if 'check_in_time' in data:
            attendance.check_in_time = datetime.fromisoformat(data['check_in_time'])
        if 'check_out_time' in data:
            attendance.check_out_time = datetime.fromisoformat(data['check_out_time'])
        if 'status' in data:
            attendance.status = data['status']
        if 'notes' in data:
            attendance.notes = data['notes']
        
        # Recalculate hours if times updated
        if attendance.check_in_time and attendance.check_out_time:
            time_diff = attendance.check_out_time - attendance.check_in_time
            attendance.total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            standard_hours = 8
            if attendance.total_hours > standard_hours:
                attendance.overtime = round(attendance.total_hours - standard_hours, 2)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Attendance updated successfully',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Update attendance error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ✅ Get all attendances with filters (for HR/Admin view)
@attendance_bp.route('/all', methods=['GET'])
def get_all_attendances():
    try:
        query = Attendance.query.join(Employee, Attendance.employee_id == Employee.id)
        
        employee_id = request.args.get('employee_id', type=int)
        status = request.args.get('status')
        filter_date = request.args.get('date')
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        search = request.args.get('search')
        
        if employee_id:
            query = query.filter(Attendance.employee_id == employee_id)
        if status and status.lower() != 'all':
            query = query.filter(Attendance.status == status)
        if filter_date:
            try:
                d = datetime.strptime(filter_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date == d)
            except:
                pass
        if year:
            query = query.filter(func.year(Attendance.date) == year)
        if month:
            query = query.filter(func.month(Attendance.date) == month)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Employee.full_name.ilike(search_term)) |
                (Employee.employee_id.ilike(search_term))
            )
            
        attendances = query.order_by(Attendance.date.desc(), Attendance.id.desc()).all()
        return jsonify({
            'success': True,
            'count': len(attendances),
            'attendances': [a.to_dict() for a in attendances]
        }), 200
    except Exception as e:
        logger.error(f"Get all attendances error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ✅ Admin mark / record attendance
@attendance_bp.route('/record', methods=['POST'])
def record_attendance():
    try:
        data = request.get_json() or {}
        employee_id = data.get('employee_id')
        rec_date = data.get('date')
        status = data.get('status', 'present')
        total_hours = float(data.get('total_hours') or 0.0)
        overtime = float(data.get('overtime') or 0.0)
        notes = data.get('notes', '')
        
        if not employee_id:
            return jsonify({'error': 'employee_id is required'}), 400
        if not rec_date:
            return jsonify({'error': 'date is required'}), 400
            
        target_date = datetime.strptime(rec_date, '%Y-%m-%d').date()
        
        # Check if record already exists for this employee on this date
        attendance = Attendance.query.filter_by(employee_id=employee_id, date=target_date).first()
        if not attendance:
            attendance = Attendance(
                employee_id=employee_id,
                date=target_date,
                status=status,
                total_hours=total_hours,
                overtime=overtime,
                notes=notes
            )
            db.session.add(attendance)
        else:
            attendance.status = status
            attendance.total_hours = total_hours
            attendance.overtime = overtime
            attendance.notes = notes
            
        if data.get('check_in_time'):
            try:
                attendance.check_in_time = datetime.fromisoformat(data['check_in_time'])
            except:
                pass
        if data.get('check_out_time'):
            try:
                attendance.check_out_time = datetime.fromisoformat(data['check_out_time'])
            except:
                pass
                
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Attendance recorded successfully',
            'data': attendance.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Record attendance error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Delete attendance record
@attendance_bp.route('/<int:attendance_id>', methods=['DELETE'])
def delete_attendance(attendance_id):
    try:
        attendance = Attendance.query.get(attendance_id)
        if not attendance:
            return jsonify({'error': 'Attendance record not found'}), 404
        db.session.delete(attendance)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Attendance record deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ✅ Daily Roster - All employees default to Present (Office hours: 8:00 AM - 5:00 PM)
@attendance_bp.route('/daily-roster', methods=['GET'])
def get_daily_roster():
    """
    Get daily attendance roster for all employees.
    All employees default to 'present' (8:00 AM - 5:00 PM) unless manually marked absent or on leave.
    Supports daily overtime tracking (1.5x for Mon-Sat, 2.0x for Sunday).
    """
    try:
        date_str = request.args.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = date.today()

        is_sunday = (target_date.weekday() == 6)
        daily_multiplier = 2.0 if is_sunday else 1.5

        # Get all employees
        employees = Employee.query.order_by(Employee.id.asc()).all()

        # Get all attendance records for this date
        attendance_records = Attendance.query.filter_by(date=target_date).all()
        attendance_map = {rec.employee_id: rec for rec in attendance_records}

        roster = []
        present_count = 0
        absent_count = 0
        leave_count = 0

        for emp in employees:
            emp_name = getattr(emp, 'full_name', getattr(emp, 'name', f"Employee #{emp.id}"))
            emp_code = getattr(emp, 'employee_id', f"EMP{emp.id}")
            department = getattr(emp, 'department', 'General')
            designation = getattr(emp, 'designation', 'Staff')

            rec = attendance_map.get(emp.id)
            if rec:
                status = (rec.status or 'present').lower()
                notes = rec.notes or ''
                att_id = rec.id
                is_exception = status in ['absent', 'leave', 'half-day']
                daily_ot = float(rec.overtime or 0.0)
            else:
                status = 'present'  # DEFAULT: Present
                notes = ''
                att_id = None
                is_exception = False
                daily_ot = 0.0

            if status == 'absent':
                absent_count += 1
            elif status in ['leave', 'half-day']:
                leave_count += 1
            else:
                present_count += 1

            roster.append({
                'employee_id': emp.id,
                'employee_name': emp_name,
                'employee_code': emp_code,
                'department': department,
                'designation': designation,
                'status': status,
                'is_exception': is_exception,
                'attendance_id': att_id,
                'notes': notes,
                'date': target_date.isoformat(),
                'standard_hours': '08:00 AM - 05:00 PM',
                'daily_overtime': daily_ot,
                'is_sunday': is_sunday,
                'ot_multiplier': daily_multiplier,
            })

        return jsonify({
            'success': True,
            'date': target_date.isoformat(),
            'office_hours': '08:00 AM - 05:00 PM',
            'is_sunday': is_sunday,
            'day_name': target_date.strftime('%A'),
            'ot_multiplier': daily_multiplier,
            'total_employees': len(employees),
            'present_count': present_count,
            'absent_count': absent_count,
            'leave_count': leave_count,
            'roster': roster
        }), 200

    except Exception as e:
        logger.error(f"Daily roster error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ✅ Mark Status - Easily mark an employee as absent, leave, or reset to present, and set daily overtime
@attendance_bp.route('/mark-status', methods=['POST'])
def mark_attendance_status():
    """
    Manually mark an employee as absent, leave, or reset to present, with optional daily overtime hours.
    """
    try:
        data = request.get_json() or {}
        emp_id = data.get('employee_id')
        date_str = data.get('date')
        new_status = data.get('status', 'absent').lower()
        notes = data.get('notes', '')
        overtime_hours = float(data.get('overtime_hours', 0.0) or 0.0)

        if not emp_id:
            return jsonify({'error': 'employee_id is required'}), 400

        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = date.today()

        emp = Employee.query.get(emp_id)
        if not emp:
            return jsonify({'error': f'Employee with id {emp_id} not found'}), 404

        existing = Attendance.query.filter_by(
            employee_id=emp_id,
            date=target_date
        ).first()

        if new_status == 'present':
            # Setting back to default present with optional daily OT
            if existing:
                existing.status = 'present'
                existing.total_hours = 8.0
                existing.overtime = overtime_hours
                existing.notes = notes
                attendance_record = existing
            else:
                attendance_record = Attendance(
                    employee_id=emp_id,
                    date=target_date,
                    status='present',
                    total_hours=8.0,
                    overtime=overtime_hours,
                    notes=notes
                )
                db.session.add(attendance_record)
        else:
            # Mark absent, leave, etc.
            hours = 4.0 if new_status == 'half-day' else 0.0
            if existing:
                existing.status = new_status
                existing.total_hours = hours
                existing.overtime = overtime_hours
                existing.notes = notes
                attendance_record = existing
            else:
                attendance_record = Attendance(
                    employee_id=emp_id,
                    date=target_date,
                    status=new_status,
                    total_hours=hours,
                    overtime=overtime_hours,
                    notes=notes
                )
                db.session.add(attendance_record)

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Attendance updated successfully',
            'data': attendance_record.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Mark status error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ✅ Get Monthly Daily-Overtime Breakdown for an Employee
@attendance_bp.route('/employee/<int:emp_id>/monthly-overtime', methods=['GET'])
def get_employee_monthly_overtime(emp_id):
    """
    Retrieve itemized daily overtime records for an employee for a specific month and year.
    Calculates total standard OT hours (1.5x on weekdays/Sat) and total Sunday OT hours (2.0x on Sunday).
    """
    try:
        month_param = request.args.get('month')  # e.g., 'November' or '11'
        year_param = request.args.get('year', datetime.utcnow().year, type=int)

        month_map = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12
        }

        if month_param and month_param.lower() in month_map:
            month_num = month_map[month_param.lower()]
        else:
            try:
                month_num = int(month_param) if month_param else datetime.utcnow().month
            except:
                month_num = datetime.utcnow().month

        # Query all attendances for this employee in this month with overtime > 0
        from sqlalchemy import extract
        attendances = Attendance.query.filter(
            Attendance.employee_id == emp_id,
            extract('year', Attendance.date) == year_param,
            extract('month', Attendance.date) == month_num,
            Attendance.overtime > 0
        ).order_by(Attendance.date.asc()).all()

        daily_records = []
        total_standard_ot = 0.0
        total_sunday_ot = 0.0

        for att in attendances:
            att_date = att.date
            is_sunday = (att_date.weekday() == 6)
            ot_hours = float(att.overtime or 0.0)

            if is_sunday:
                total_sunday_ot += ot_hours
                multiplier = 2.0
            else:
                total_standard_ot += ot_hours
                multiplier = 1.5

            daily_records.append({
                'date': att_date.isoformat(),
                'day_name': att_date.strftime('%A'),
                'hours': ot_hours,
                'is_sunday': is_sunday,
                'multiplier': multiplier,
                'notes': att.notes or ''
            })

        return jsonify({
            'success': True,
            'employee_id': emp_id,
            'month': month_param,
            'year': year_param,
            'total_standard_ot_hours': round(total_standard_ot, 2),
            'total_sunday_ot_hours': round(total_sunday_ot, 2),
            'record_count': len(daily_records),
            'daily_records': daily_records
        }), 200

    except Exception as e:
        logger.error(f"Monthly overtime error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


