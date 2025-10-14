#!/bin/bash

# Database Restore Script
# Usage: ./restore_db.sh [snapshot_file] [--delete-snapshot]
# Example: ./restore_db.sh backups/database_snapshot_20251014_182204.sql --delete-snapshot

set -e  # Exit on any error

# Configuration
CONTAINER_NAME="better_lsat_mcat-pgsqldb-1"
DB_USER="root"
DB_NAME="example_db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Database Restore Script${NC}"
echo "=================================="

# Check if snapshot file is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: No snapshot file provided!${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./restore_db.sh <snapshot_file> [--delete-snapshot]"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./restore_db.sh backups/database_snapshot_20251014_182204.sql"
    echo "  ./restore_db.sh backups/database_snapshot_20251014_182204.sql --delete-snapshot"
    echo ""
    echo -e "${YELLOW}Available snapshots:${NC}"
    if [ -d "./backups" ]; then
        ls -la ./backups/database_snapshot_*.sql 2>/dev/null || echo "  No snapshots found in ./backups/"
    else
        echo "  No backups directory found"
    fi
    exit 1
fi

SNAPSHOT_FILE="$1"
DELETE_SNAPSHOT=false

# Check for delete flag
if [ "$2" = "--delete-snapshot" ]; then
    DELETE_SNAPSHOT=true
fi

# Check if snapshot file exists
if [ ! -f "$SNAPSHOT_FILE" ]; then
    echo -e "${RED}❌ Error: Snapshot file '$SNAPSHOT_FILE' not found!${NC}"
    exit 1
fi

# Check if Docker container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${RED}❌ Error: Database container '$CONTAINER_NAME' is not running!${NC}"
    echo "Please start your database with: docker-compose up -d pgsqldb"
    exit 1
fi

# Show snapshot info
FILE_SIZE=$(ls -lh "$SNAPSHOT_FILE" | awk '{print $5}')
echo -e "${YELLOW}📄 Snapshot file: $SNAPSHOT_FILE${NC}"
echo -e "${YELLOW}📊 File size: $FILE_SIZE${NC}"

# Check if it's a compressed file
if [[ "$SNAPSHOT_FILE" == *.gz ]]; then
    echo -e "${YELLOW}🗜️  Detected compressed file, will decompress during restore${NC}"
fi

# Warning about data loss
echo ""
echo -e "${RED}⚠️  WARNING: This will completely replace the current database!${NC}"
echo -e "${RED}   All existing data in '$DB_NAME' will be lost!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}❌ Restore cancelled by user${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔄 Starting database restore...${NC}"

# Drop existing database and recreate
echo -e "${YELLOW}🗑️  Dropping existing database...${NC}"
docker exec $CONTAINER_NAME psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres || true

echo -e "${YELLOW}🆕 Creating new database...${NC}"
docker exec $CONTAINER_NAME psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" postgres

# Restore from snapshot
echo -e "${YELLOW}📥 Restoring data from snapshot...${NC}"

if [[ "$SNAPSHOT_FILE" == *.gz ]]; then
    # Compressed file
    gunzip -c "$SNAPSHOT_FILE" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
else
    # Regular SQL file
    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < "$SNAPSHOT_FILE"
fi

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database restored successfully!${NC}"
    
    # Show some stats
    echo -e "${YELLOW}📊 Database statistics:${NC}"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            schemaname,
            tablename,
            n_tup_ins as rows
        FROM pg_stat_user_tables 
        ORDER BY n_tup_ins DESC;
    " 2>/dev/null || echo "  Could not retrieve table statistics"
    
    # Delete snapshot if requested
    if [ "$DELETE_SNAPSHOT" = true ]; then
        echo ""
        echo -e "${YELLOW}🗑️  Deleting snapshot file...${NC}"
        rm "$SNAPSHOT_FILE"
        echo -e "${GREEN}✅ Snapshot file deleted: $SNAPSHOT_FILE${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Restore completed successfully!${NC}"
    echo "=================================="
    echo -e "${YELLOW}Database '$DB_NAME' has been restored from:${NC}"
    echo "  📄 $SNAPSHOT_FILE"
    echo ""
    echo -e "${YELLOW}You can now:${NC}"
    echo "  • Start your application: docker-compose up -d app"
    echo "  • Check the database: docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    
else
    echo -e "${RED}❌ Error: Database restore failed!${NC}"
    exit 1
fi
