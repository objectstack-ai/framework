import { describe, it, expect } from 'vitest';
import AuthLogin from '../src/commands/auth/login';
import AuthLogout from '../src/commands/auth/logout';
import AuthWhoami from '../src/commands/auth/whoami';
import DataQuery from '../src/commands/data/query';
import DataGet from '../src/commands/data/get';
import DataCreate from '../src/commands/data/create';
import DataUpdate from '../src/commands/data/update';
import DataDelete from '../src/commands/data/delete';
import MetaList from '../src/commands/meta/list';
import MetaGet from '../src/commands/meta/get';
import MetaRegister from '../src/commands/meta/register';
import MetaDelete from '../src/commands/meta/delete';

describe('Remote API Commands (oclif)', () => {
  describe('Auth Commands', () => {
    it('should have auth login command', () => {
      expect(AuthLogin.description).toContain('Authenticate');
      expect(AuthLogin.flags).toHaveProperty('url');
      expect(AuthLogin.flags).toHaveProperty('email');
      expect(AuthLogin.flags).toHaveProperty('password');
      expect(AuthLogin.flags).toHaveProperty('json');
    });

    it('should have auth logout command', () => {
      expect(AuthLogout.description).toContain('Clear');
      expect(AuthLogout.flags).toHaveProperty('json');
    });

    it('should have auth whoami command', () => {
      expect(AuthWhoami.description).toContain('session');
      expect(AuthWhoami.flags).toHaveProperty('url');
      expect(AuthWhoami.flags).toHaveProperty('token');
      expect(AuthWhoami.flags).toHaveProperty('format');
    });

    it('auth commands should have examples', () => {
      expect(AuthLogin.examples).toBeDefined();
      expect(AuthLogin.examples.length).toBeGreaterThan(0);
      expect(AuthLogout.examples).toBeDefined();
      expect(AuthWhoami.examples).toBeDefined();
    });
  });

  describe('Data Commands', () => {
    it('should have data query command', () => {
      expect(DataQuery.description).toContain('Query');
      expect(DataQuery.args).toHaveProperty('object');
      expect(DataQuery.flags).toHaveProperty('filter');
      expect(DataQuery.flags).toHaveProperty('fields');
      expect(DataQuery.flags).toHaveProperty('sort');
      expect(DataQuery.flags).toHaveProperty('limit');
      expect(DataQuery.flags).toHaveProperty('offset');
      expect(DataQuery.flags).toHaveProperty('format');
    });

    it('should have data get command', () => {
      expect(DataGet.description).toContain('single record');
      expect(DataGet.args).toHaveProperty('object');
      expect(DataGet.args).toHaveProperty('id');
      expect(DataGet.flags).toHaveProperty('format');
    });

    it('should have data create command', () => {
      expect(DataCreate.description).toContain('Create');
      expect(DataCreate.args).toHaveProperty('object');
      expect(DataCreate.flags).toHaveProperty('data');
      expect(DataCreate.flags).toHaveProperty('format');
    });

    it('should have data update command', () => {
      expect(DataUpdate.description).toContain('Update');
      expect(DataUpdate.args).toHaveProperty('object');
      expect(DataUpdate.args).toHaveProperty('id');
      expect(DataUpdate.flags).toHaveProperty('data');
      expect(DataUpdate.flags).toHaveProperty('format');
    });

    it('should have data delete command', () => {
      expect(DataDelete.description).toContain('Delete');
      expect(DataDelete.args).toHaveProperty('object');
      expect(DataDelete.args).toHaveProperty('id');
      expect(DataDelete.flags).toHaveProperty('format');
    });

    it('data commands should support common flags', () => {
      const commands = [DataQuery, DataGet, DataCreate, DataUpdate, DataDelete];
      commands.forEach(cmd => {
        expect(cmd.flags).toHaveProperty('url');
        expect(cmd.flags).toHaveProperty('token');
      });
    });

    it('data commands should have examples', () => {
      expect(DataQuery.examples).toBeDefined();
      expect(DataQuery.examples.length).toBeGreaterThan(0);
      expect(DataGet.examples).toBeDefined();
      expect(DataCreate.examples).toBeDefined();
      expect(DataUpdate.examples).toBeDefined();
      expect(DataDelete.examples).toBeDefined();
    });
  });

  describe('Metadata Commands', () => {
    it('should have meta list command', () => {
      expect(MetaList.description).toContain('List metadata');
      expect(MetaList.args).toHaveProperty('type');
      expect(MetaList.flags).toHaveProperty('format');
    });

    it('should have meta get command', () => {
      expect(MetaGet.description).toContain('Get');
      expect(MetaGet.args).toHaveProperty('type');
      expect(MetaGet.args).toHaveProperty('name');
      expect(MetaGet.flags).toHaveProperty('format');
    });

    it('should have meta register command', () => {
      expect(MetaRegister.description).toContain('Register');
      expect(MetaRegister.args).toHaveProperty('type');
      expect(MetaRegister.flags).toHaveProperty('data');
      expect(MetaRegister.flags).toHaveProperty('format');
    });

    it('should have meta delete command', () => {
      expect(MetaDelete.description).toContain('Delete');
      expect(MetaDelete.args).toHaveProperty('type');
      expect(MetaDelete.args).toHaveProperty('name');
      expect(MetaDelete.flags).toHaveProperty('format');
    });

    it('meta commands should support common flags', () => {
      const commands = [MetaList, MetaGet, MetaRegister, MetaDelete];
      commands.forEach(cmd => {
        expect(cmd.flags).toHaveProperty('url');
        expect(cmd.flags).toHaveProperty('token');
      });
    });

    it('meta commands should have examples', () => {
      expect(MetaList.examples).toBeDefined();
      expect(MetaList.examples.length).toBeGreaterThan(0);
      expect(MetaGet.examples).toBeDefined();
      expect(MetaRegister.examples).toBeDefined();
      expect(MetaDelete.examples).toBeDefined();
    });
  });

  describe('Command Conventions', () => {
    it('all remote commands should support --url flag with OBJECTSTACK_URL env var', () => {
      const commands = [
        AuthLogin, AuthWhoami,
        DataQuery, DataGet, DataCreate, DataUpdate, DataDelete,
        MetaList, MetaGet, MetaRegister, MetaDelete
      ];

      commands.forEach(cmd => {
        expect(cmd.flags).toHaveProperty('url');
        expect(cmd.flags.url).toHaveProperty('env', 'OBJECTSTACK_URL');
      });
    });

    it('authenticated commands should support --token flag with OBJECTSTACK_TOKEN env var', () => {
      const commands = [
        AuthWhoami,
        DataQuery, DataGet, DataCreate, DataUpdate, DataDelete,
        MetaList, MetaGet, MetaRegister, MetaDelete
      ];

      commands.forEach(cmd => {
        expect(cmd.flags).toHaveProperty('token');
        expect(cmd.flags.token).toHaveProperty('env', 'OBJECTSTACK_TOKEN');
      });
    });

    it('all commands should support output formatting', () => {
      const commands = [
        AuthWhoami,
        DataQuery, DataGet, DataCreate, DataUpdate, DataDelete,
        MetaList, MetaGet, MetaRegister, MetaDelete
      ];

      commands.forEach(cmd => {
        expect(cmd.flags).toHaveProperty('format');
      });
    });
  });
});
