import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/notes_remote_data_source.dart';
import '../../data/repositories/notes_repository_impl.dart';
import '../../domain/repositories/notes_repository.dart';

final notesRemoteDataSourceProvider = Provider<NotesRemoteDataSource>((ref) {
  return NotesRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final notesRepositoryProvider = Provider<NotesRepository>((ref) {
  return NotesRepositoryImpl(ref.watch(notesRemoteDataSourceProvider));
});

final classLinkNotesProvider = FutureProvider.autoDispose.family((ref, String classId) {
  return ref.watch(notesRepositoryProvider).getClassLinkNotes(classId);
});
