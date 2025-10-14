#!/bin/bash

# Database Backup Script
# Usage: ./backup_db.sh

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups"
CONTAINER_NAME="better_lsat_mcat-pgsqldb-1"
DB_USER="root"
DB_NAME="example_db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🗄️  Database Backup Script${NC}"
echo "=================================="

# Check if Docker container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${RED}❌ Error: Database container '$CONTAINER_NAME' is not running!${NC}"
    echo "Please start your database with: docker-compose up -d pgsqldb"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo -e "${YELLOW}📦 Creating database snapshot...${NC}"

# Create SQL dump
SQL_FILE="$BACKUP_DIR/database_snapshot_$TIMESTAMP.sql"
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > $SQL_FILE

# Check if dump was successful
if [ $? -eq 0 ] && [ -s "$SQL_FILE" ]; then
    echo -e "${GREEN}✅ SQL dump created: $SQL_FILE${NC}"
    
    # Get file size
    FILE_SIZE=$(ls -lh "$SQL_FILE" | awk '{print $5}')
    echo -e "${GREEN}📊 File size: $FILE_SIZE${NC}"
    
    # Create compressed version
    COMPRESSED_FILE="$BACKUP_DIR/database_snapshot_$TIMESTAMP.sql.gz"
    gzip -c "$SQL_FILE" > "$COMPRESSED_FILE"
    
    COMPRESSED_SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')
    echo -e "${GREEN}🗜️  Compressed version: $COMPRESSED_FILE ($COMPRESSED_SIZE)${NC}"
    
    # Show backup summary
    echo ""
    echo -e "${GREEN}🎉 Backup completed successfully!${NC}"
    echo "=================================="
    echo -e "${YELLOW}Files created:${NC}"
    echo "  📄 SQL dump:     $SQL_FILE"
    echo "  🗜️  Compressed:   $COMPRESSED_FILE"
    echo ""
    echo -e "${YELLOW}To restore this backup, use:${NC}"
    echo "  ./restore_db.sh $SQL_FILE"
    echo ""
    
else
    echo -e "${RED}❌ Error: Failed to create database dump!${NC}"
    exit 1
fi

# Optional: Keep only last 5 backups (uncomment if needed)
# echo -e "${YELLOW}🧹 Cleaning old backups (keeping last 5)...${NC}"
# ls -t $BACKUP_DIR/database_snapshot_*.sql | tail -n +6 | xargs -r rm
# ls -t $BACKUP_DIR/database_snapshot_*.sql.gz | tail -n +6 | xargs -r rm
