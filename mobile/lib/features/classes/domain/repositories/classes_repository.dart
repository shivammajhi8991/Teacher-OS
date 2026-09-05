import '../../../../core/utils/result.dart';
import '../entities/class_schedule.dart';
import '../entities/enrollment_summary.dart';
import '../entities/schedule_conflict.dart';
import '../entities/teaching_class.dart';

abstract interface class ClassesRepository {
  Future<Result<TeachingClass>> createClass({
    required String name,
    String? subjectOrActivity,
    String? classType,
    required String mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    required String startDate,
    String? endDate,
  });

  Future<Result<List<TeachingClass>>> listClasses({String? status});

  Future<Result<TeachingClass>> getClass(String id);

  Future<Result<TeachingClass>> updateClass(
    String id, {
    String? name,
    String? subjectOrActivity,
    String? mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    String? endDate,
    String? status,
  });

  Future<Result<ClassSchedule?>> getSchedule(String classId);

  Future<Result<ClassSchedule>> setSchedule(
    String classId, {
    required String effectiveFrom,
    required String recurrenceRule,
    required String startTime,
    required String endTime,
    String? timezone,
  });

  Future<Result<List<ScheduleConflict>>> getConflicts(String classId);

  Future<Result<List<EnrollmentSummary>>> getEnrollments(String classId);

  Future<Result<EnrollmentSummary>> enrollStudent(String classId, String studentId, {String? enrollmentType});

  Future<Result<void>> addToWaitlist(String classId, String studentId);
}
