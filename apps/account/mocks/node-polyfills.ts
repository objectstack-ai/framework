export class EventEmitter {
  on() { return this; }
  off() { return this; }
  emit() { return true; }
  once() { return this; }
  addListener() { return this; }
  removeListener() { return this; }
  removeAllListeners() { return this; }
}
export default { EventEmitter };

export class Stream extends EventEmitter {
    pipe() { return this; }
}
export class Readable extends Stream {}
export class Writable extends Stream {}
export class Transform extends Stream {}

export class StringDecoder {
  write() { return ''; }
  end() { return ''; }
}

export const promises = {
  readFile: async () => '',
  writeFile: async () => {},
  stat: async () => ({ isDirectory: () => false, isFile: () => false }),
  mkdir: async () => {},
  rm: async () => {},
  access: async () => { throw new Error('ENOENT: no such file or directory (polyfill)'); },
};

// os polyfills
export const type = () => 'Browser';
export const platform = () => 'browser';
export const release = () => '1.0.0';
export const tmpdir = () => '/tmp';
export const homedir = () => '/';
export const endianness = () => 'LE';
export const arch = () => 'javascript';
export const EOL = '\n';

export const readFileSync = () => '';
export const writeFileSync = () => {};
export const statSync = () => ({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false });
export const lstatSync = () => ({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false });
export const existsSync = () => false;
export const join = (...args) => args.join('/');
export const resolve = (...args) => args.join('/');
export const dirname = (path) => path;
export const basename = (path) => path;
export const extname = (path) => '';
export const sep = '/';
export const relative = () => '';
export const isAbsolute = () => false;
export const normalize = (p: string) => p;

export const posix = {};
export const win32 = {};

// fs/promises and other missing exports
export const open = async () => ({ close: async () => {} });
export class Stats {
  isDirectory() { return false; }
  isFile() { return false; }
  isSymbolicLink() { return false; }
}
export const watchFile = () => {};
export const unwatchFile = () => {};

export const fileURLToPath = () => '';
export const pathToFileURL = () => '';

export const readdir = () => {};
export const readdirSync = () => [];
export const readlink = () => {};
export const readlinkSync = () => '';
export const realpath = async () => '';
export const realpathSync = () => '';
realpathSync.native = () => '';

export const constants = {};
export const lstat = async () => ({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false });
export const stat = async () => ({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false });
export const access = async () => { throw new Error('ENOENT: no such file or directory (polyfill)'); };
export const accessSync = () => { throw new Error('ENOENT: no such file or directory (polyfill)'); };
export const mkdir = () => {};
export const mkdirSync = () => {};
export const rmdir = () => {};
export const rmdirSync = () => {};
export const unlink = () => {};
export const unlinkSync = () => {};
export const copyFile = () => {};
export const copyFileSync = () => {};
export const createReadStream = () => new Readable();
export const createWriteStream = () => new Writable();
export const watch = () => new EventEmitter();

export const readFile = async () => '';
export const writeFile = async () => {};
export const rename = async () => {};
export const renameSync = () => {};
export const createHash = () => ({ update: () => ({ digest: () => '' }) });
export const randomUUID = () => '00000000-0000-0000-0000-000000000000';
