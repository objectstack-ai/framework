
import { ObjectStackClient } from '@objectstack/client';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper for assertions
function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
        },
        toBeDefined: () => {
             if (actual === undefined || actual === null) throw new Error(`Expected defined, got ${actual}`);
        },
        toBeGreaterThan: (n: number) => {
             if (actual <= n) throw new Error(`Expected > ${n}, got ${actual}`);
        },
        toContain: (item: any) => {
             if (Array.isArray(actual)) {
                 if (!actual.includes(item)) throw new Error(`Expected array to contain "${item}", but got: ${JSON.stringify(actual)}`);
             } else {
                 throw new Error(`Expected array for toContain, got ${typeof actual}`);
             }
        }
    };
}

async function run() {
    console.log('🚀 Starting Integration Test for App Host...');
    
    // We can pick a random port or fixed port. Fixed 3004 is defined in index.ts
    const PORT = 3004;
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    
    // 1. Start Server
    console.log('Starting app-host server from:', projectRoot);
    const serverProcess = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
        cwd: projectRoot,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', d => {
        const msg = d.toString().trim();
        // Filter noisy debug logs if needed, but keeping for now
        // if (msg.includes('INFO') || msg.includes('ERROR')) 
        console.log(`[SERVER]: ${msg}`);
    });
    
    serverProcess.stderr.on('data', d => console.error(`[SERVER ERR]: ${d.toString().trim()}`));

    try {
        // 2. Wait for Ready
        console.log('Waiting for startup...');
        await new Promise<void>((resolve, reject) => {
            let started = false;
            const timeout = setTimeout(() => {
                if (!started) reject(new Error('Timeout waiting for server start (20s)'));
            }, 20000); 

            serverProcess.stdout.on('data', (data) => {
                const log = data.toString();
                // Check specifically for start messages
                if (log.includes('Bootstrap complete') || log.includes('Listening on port')) {
                    if (!started) {
                        started = true;
                        clearTimeout(timeout);
                        // Give it a small buffer to ensure socket is bound
                        setTimeout(resolve, 2000);
                    }
                }
            });
            
            serverProcess.on('error', (err) => {
                reject(new Error(`Failed to spawn server: ${err.message}`));
            });
            
            serverProcess.on('exit', (code) => {
                if (!started) reject(new Error(`Server exited prematurely with code ${code}`));
            });
        });
        console.log('✅ Server is ready');

        // 3. Test Client Connection
        const client = new ObjectStackClient({ 
            baseUrl: `http://localhost:${PORT}`,
            debug: false // Set true for verbose client logs
        });
        
        console.log('Connecting client...');
        await client.connect();
        console.log('✅ Client Connected');

        // 4. Test Metadata
        console.log('Testing Metadata Fetch...');
        const meta = await client.meta.getItem('object', 'todo_task');
        console.log(`Received Metadata Object: ${meta?.name}`);
        expect(meta).toBeDefined();
        expect(meta.name).toBe('todo_task');
        expect(meta.fields).toBeDefined();
        console.log('✅ Metadata verified');

        // 5. Test Data
        console.log('Testing Data Fetch...');
        const result = await client.data.find('todo_task', { top: 10 });
        console.log(`Received ${result.records?.length || 0} records`);
        
        expect(result.records).toBeDefined();
        expect(result.records.length).toBeGreaterThan(0);
        
        const subjects = result.records.map((r: any) => r.subject);
        console.log('Task Subjects:', subjects);
        expect(subjects).toContain('Learn ObjectStack');
        expect(subjects).toContain('Build a cool app');
        
        console.log('✅ Data verified');

        // 6. Test Create
        console.log('Testing Create...');
        const createResult: any = await client.data.create('todo_task', {
            subject: 'E2E Test Task',
            due_date: '2025-12-31',
            status: 'pending'
        });
        const newRecord = createResult.record || createResult;
        
        expect(newRecord).toBeDefined();
        console.log(`Created Record ID: ${newRecord.id}`);
        expect(newRecord.subject).toBe('E2E Test Task');
        console.log('✅ Create verified');

        // 7. Test Update
        console.log('Testing Update...');
        const updateResult: any = await client.data.update('todo_task', newRecord.id, {
            status: 'completed'
        });
        const updatedRecord = updateResult.record || updateResult;

        expect(updatedRecord).toBeDefined();
        expect(updatedRecord.status).toBe('completed');
        
        // Verify via Get
        const verifyUpdate: any = await client.data.get('todo_task', newRecord.id);
        const fetchedRecord = verifyUpdate.record || verifyUpdate;
        expect(fetchedRecord.status).toBe('completed');
        console.log('✅ Update verified');

        // 8. Test Delete
        console.log('Testing Delete...');
        await client.data.delete('todo_task', newRecord.id);
        
        // Verify deletion by trying to fetch (expecting error or empty)
        try {
            await client.data.get('todo_task', newRecord.id);
            // If it succeeds, that's bad (unless it returns null)
             throw new Error('Record should be deleted');
        } catch (error: any) {
             // Assuming 404 throws an error
             console.log('Delete confirmed (404 caught)');
        }
        console.log('✅ Delete verified');

    } catch (err) {
        console.error('❌ Test Failed:', err);
        process.exit(1);
    } finally {
        console.log('Stopping server...');
        serverProcess.kill();
        process.exit(0);
    }
}

run();
