import 'package:dio/dio.dart';

class CalendarRemoteDataSource {
  const CalendarRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> getCalendar({required String from, required String to}) async {
    final response = await _dio.get('/calendar', queryParameters: {'from': from, 'to': to});
    return response.data as List<dynamic>;
  }
}
