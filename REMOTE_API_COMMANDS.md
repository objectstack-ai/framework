# Remote API Commands

The ObjectStack CLI now includes commands to interact with a running ObjectStack server via its REST APIs.

## Authentication

Before using remote API commands, you need to authenticate:

```bash
# Login and store credentials
os auth login --url https://api.example.com

# Show current session
os auth whoami

# Logout (clear stored credentials)
os auth logout
```

Credentials are stored in `~/.objectstack/credentials.json` and automatically used for subsequent commands.

Alternatively, you can provide credentials via environment variables or flags:

```bash
# Using environment variables
export OBJECTSTACK_URL=https://api.example.com
export OBJECTSTACK_TOKEN=your-token-here

# Using flags
os data query project_task --url https://api.example.com --token your-token-here
```

## Data API Commands

### Query Records

```bash
# Query all records
os data query project_task

# Filter records
os data query project_task --filter '{"status":"open"}'

# Limit and pagination
os data query project_task --limit 10 --offset 0

# Select specific fields
os data query project_task --fields name,status,created_at

# Sort results
os data query project_task --sort -created_at  # descending
os data query project_task --sort created_at    # ascending

# Output formats
os data query project_task --format json
os data query project_task --format yaml
os data query project_task --format table  # default
```

### Get a Single Record

```bash
os data get project_task abc123
os data get project_task abc123 --format json
```

### Create a Record

```bash
# From JSON string
os data create project_task '{"name":"New Task","status":"open"}'

# From JSON file
os data create project_task --data task.json
```

### Update a Record

```bash
# From JSON string
os data update project_task abc123 '{"status":"completed"}'

# From JSON file
os data update project_task abc123 --data update.json
```

### Delete a Record

```bash
os data delete project_task abc123
```

## Metadata API Commands

### List Metadata Types

```bash
# List all available metadata types
os meta list

# List items of a specific type
os meta list object
os meta list plugin
os meta list view
```

### Get Metadata Item

```bash
os meta get object project_task
os meta get plugin my-plugin --format json
```

### Register Metadata

```bash
# Register from JSON file
os meta register object --data object-definition.json
os meta register plugin --data plugin-manifest.json
```

The metadata file must include a `name` field:

```json
{
  "name": "my_custom_object",
  "label": "My Custom Object",
  "fields": {
    "name": {
      "type": "text",
      "label": "Name"
    }
  }
}
```

### Delete Metadata

```bash
os meta delete object my_custom_object
os meta delete plugin my-plugin
```

## Output Formats

Most commands support multiple output formats via the `--format` flag:

- `json` - Machine-readable JSON output
- `yaml` - Human-readable YAML output
- `table` - Formatted table output (default for most commands)

## Environment Variables

The following environment variables are supported:

- `OBJECTSTACK_URL` - Default server URL (default: `http://localhost:3000`)
- `OBJECTSTACK_TOKEN` - Authentication token (alternative to `os auth login`)

## Examples

### Complete Workflow

```bash
# 1. Login
os auth login --url https://api.example.com
Email: user@example.com
Password: ********

# 2. Query data
os data query project_task --filter '{"status":"open"}' --limit 5

# 3. Create a new record
os data create project_task '{"name":"Implement feature","status":"open","priority":"high"}'

# 4. Update the record
os data update project_task abc123 '{"status":"in_progress"}'

# 5. List metadata
os meta list object

# 6. Get object definition
os meta get object project_task --format yaml
```

### CI/CD Integration

```bash
# Use token authentication in CI/CD pipelines
export OBJECTSTACK_URL=https://api.production.com
export OBJECTSTACK_TOKEN=${{ secrets.OBJECTSTACK_TOKEN }}

# Deploy metadata
os meta register object --data objects/project_task.json

# Verify deployment
os meta get object project_task --format json
```
