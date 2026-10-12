import { pipeFromLocalDbInfo, redactDbError } from '@infrastructure/persistence/mssql-executor';

describe('localdb connection text', () => {
  it('reads the instance pipe and hides a password in errors', () => {
    const pipe = pipeFromLocalDbInfo('Nombre: MSSQLLocalDB\nNombre de canalizacion de instancia: np:\\\\.\\pipe\\LOCALDB#ABC\\tsql\\query\n');

    expect(pipe.startsWith('\\\\.\\pipe\\')).toBe(true);
    expect(pipe).toContain('LOCALDB#ABC');
    expect(redactDbError(new Error('Login failed password=secret-value')).message).toContain('password=(redacted)');
    expect(redactDbError(new Error('Login failed password=secret-value')).message).not.toContain('secret-value');
  });
});