# Database Backup & Restore Scripts

This directory contains two shell scripts for managing database snapshots.

## 📦 backup_db.sh

Creates a snapshot of your PostgreSQL database.

### Usage

```bash
./backup_db.sh
```

### What it does

- ✅ Checks if database container is running
- 📄 Creates SQL dump of the database
- 🗜️ Creates compressed version (.gz)
- 📊 Shows file sizes and statistics
- 💾 Saves files to `./backups/` directory

### Output

- `database_snapshot_YYYYMMDD_HHMMSS.sql` - Full SQL dump
- `database_snapshot_YYYYMMDD_HHMMSS.sql.gz` - Compressed version

---

## 🔄 restore_db.sh

Restores database from a snapshot file.

### Usage

```bash
# Basic restore
./restore_db.sh backups/database_snapshot_20251014_182400.sql

# Restore and delete snapshot file
./restore_db.sh backups/database_snapshot_20251014_182400.sql --delete-snapshot

# Show available snapshots
./restore_db.sh
```

### What it does

- ✅ Checks if snapshot file exists
- ✅ Checks if database container is running
- ⚠️ Shows warning about data loss
- 🗑️ Drops existing database
- 🆕 Creates new database
- 📥 Restores data from snapshot
- 🗑️ Optionally deletes snapshot file
- 📊 Shows restore statistics

### Safety Features

- ⚠️ **WARNING**: Completely replaces existing database
- 🔒 Requires user confirmation
- ✅ Validates file existence and container status
- 📊 Shows restore progress and statistics

---

## 🚀 Quick Examples

### Create a backup

```bash
./backup_db.sh
```

### List available backups

```bash
ls -la backups/
```

### Restore from backup

```bash
./restore_db.sh backups/database_snapshot_20251014_182400.sql
```

### Restore and cleanup

```bash
./restore_db.sh backups/database_snapshot_20251014_182400.sql --delete-snapshot
```

---

## 📁 File Structure

```
.
├── backup_db.sh          # Backup script
├── restore_db.sh         # Restore script
├── backups/              # Backup directory
│   ├── database_snapshot_20251014_182400.sql
│   └── database_snapshot_20251014_182400.sql.gz
└── README.md             # This file
```

---

## ⚙️ Configuration

The scripts use these default settings:

- **Container**: `better_lsat_mcat-pgsqldb-1`
- **Database User**: `root`
- **Database Name**: `example_db`
- **Backup Directory**: `./backups/`

To modify these settings, edit the variables at the top of each script.

---

## 🛠️ Troubleshooting

### Database container not running

```bash
docker-compose up -d pgsqldb
```

### Permission denied

```bash
chmod +x backup_db.sh restore_db.sh
```

### No snapshots found

```bash
./backup_db.sh  # Create a backup first
```

---

## 🔒 Security Notes

- ⚠️ **Backup files contain sensitive data** - store securely
- 🗑️ **Restore completely replaces database** - backup current data first
- 🔐 **Database credentials** are stored in environment variables
- 📁 **Backup directory** should have appropriate permissions
