import { parseCsv } from './csv-parser.util';

describe('parseCsv', () => {
  it('parses a simple CSV into header-keyed row objects', () => {
    const csv = 'fullName,dob\nJamie Lee,2015-01-01\nAlex Kim,2016-06-15';
    expect(parseCsv(csv)).toEqual([
      { fullName: 'Jamie Lee', dob: '2015-01-01' },
      { fullName: 'Alex Kim', dob: '2016-06-15' },
    ]);
  });

  it('handles a quoted field containing a comma', () => {
    const csv = 'fullName,emergencyContactName\n"Lee, Jamie","Doe, Jane"';
    expect(parseCsv(csv)).toEqual([
      { fullName: 'Lee, Jamie', emergencyContactName: 'Doe, Jane' },
    ]);
  });

  it('handles a doubled quote as an escaped literal quote', () => {
    const csv = 'fullName\n"Jamie ""JJ"" Lee"';
    expect(parseCsv(csv)).toEqual([{ fullName: 'Jamie "JJ" Lee' }]);
  });

  it('handles a quoted field spanning multiple lines', () => {
    const csv = 'fullName,medicalNotes\nJamie Lee,"Line one\nLine two"';
    expect(parseCsv(csv)).toEqual([
      { fullName: 'Jamie Lee', medicalNotes: 'Line one\nLine two' },
    ]);
  });

  it('handles CRLF line endings', () => {
    const csv = 'fullName,dob\r\nJamie Lee,2015-01-01\r\n';
    expect(parseCsv(csv)).toEqual([
      { fullName: 'Jamie Lee', dob: '2015-01-01' },
    ]);
  });

  it('parses the last row even without a trailing newline', () => {
    const csv = 'fullName\nJamie Lee';
    expect(parseCsv(csv)).toEqual([{ fullName: 'Jamie Lee' }]);
  });

  it('skips fully-blank trailing lines', () => {
    const csv = 'fullName\nJamie Lee\n\n';
    expect(parseCsv(csv)).toEqual([{ fullName: 'Jamie Lee' }]);
  });

  it('returns an empty array for a header-only CSV', () => {
    expect(parseCsv('fullName,dob')).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
