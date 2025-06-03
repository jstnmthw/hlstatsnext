# Makefile for hlstatsnext.com Docker management
# ===============================================

# Default variables
COMPOSE_FILE := docker-compose.yml
DAEMON_CONTAINER := hlstatsnext-daemon
DB_CONTAINER := hlstatsnext-db
CS1_CONTAINER := hlstatsnext-cs-1
CS2_CONTAINER := hlstatsnext-cs-2

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target (make without arguments)
.DEFAULT_GOAL := restart

# Declare all targets as phony
.PHONY: help restart up down build logs status clean \
        daemon-restart daemon-logs daemon-shell \
        db-reset db-logs db-shell db-backup \
        cs1-restart cs1-details cs1-logs cs1-shell cs1-stop cs1-start \
        cs2-restart cs2-details cs2-logs cs2-shell cs2-stop cs2-start \
        prune

# Help target - shows available commands
help:
	@echo ""
	@echo "$(GREEN)HLStatsNext$(NC) Docker Management Commands"
	@echo "---------------------------------------"
	@echo ""
	@echo "$(YELLOW)Main Commands:$(NC)"
	@echo "  make                    - Default: brings containers down then up"
	@echo "  make restart            - Same as default (down + up)"
	@echo "  make up                 - Start all containers"
	@echo "  make down               - Stop all containers"
	@echo "  make build              - Build containers with no cache"
	@echo "  make logs               - Show logs for all containers"
	@echo "  make status             - Show status of all containers"
	@echo ""
	@echo "$(YELLOW)CS1 Server Commands:$(NC)"
	@echo "  make cs1-restart        - Restart CS1 server (linuxgsm csserver restart)"
	@echo "  make cs1-details        - Show CS1 server details (linuxgsm csserver details)"
	@echo "  make cs1-start          - Start CS1 server (linuxgsm csserver start)"
	@echo "  make cs1-stop           - Stop CS1 server (linuxgsm csserver stop)"
	@echo "  make cs1-logs           - Show CS1 container logs"
	@echo "  make cs1-shell          - Access CS1 container shell"
	@echo ""
	@echo "$(YELLOW)CS2 Server Commands:$(NC)"
	@echo "  make cs2-restart        - Restart CS2 server (linuxgsm csserver restart)"
	@echo "  make cs2-details        - Show CS2 server details (linuxgsm csserver details)"
	@echo "  make cs2-start          - Start CS2 server (linuxgsm csserver start)"
	@echo "  make cs2-stop           - Stop CS2 server (linuxgsm csserver stop)"
	@echo "  make cs2-logs           - Show CS2 container logs"
	@echo "  make cs2-shell          - Access CS2 container shell"
	@echo ""
	@echo "$(YELLOW)Daemon Commands:$(NC)"
	@echo "  make daemon-restart     - Restart the daemon container"
	@echo "  make daemon-logs        - Show daemon container logs"
	@echo "  make daemon-shell       - Access daemon container shell"
	@echo ""
	@echo "$(YELLOW)Database Commands:$(NC)"
	@echo "  make db-reset           - Restart the database server"
	@echo "  make db-logs            - Show database container logs"
	@echo "  make db-shell           - Access database container shell"
	@echo "  make db-backup          - Create database backup"
	@echo ""
	@echo "$(YELLOW)Utility Commands:$(NC)"
	@echo "  make clean              - Remove stopped containers and unused images"
	@echo "  make prune              - Remove all unused Docker resources"

# ===========================================
# MAIN COMMANDS
# ===========================================

# Default target: restart (down + up)
restart: down up
	@echo "$(GREEN)✓ All containers restarted$(NC)"

# Start all containers
up:
	@echo "$(GREEN)Starting all containers...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✓ All containers started$(NC)"

# Stop all containers
down:
	@echo "$(YELLOW)Stopping all containers...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✓ All containers stopped$(NC)"

# Build containers with no cache
build:
	@echo "$(GREEN)Building containers with no cache...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@echo "$(GREEN)✓ All containers built$(NC)"

# Show logs for all containers
logs:
	@docker-compose -f $(COMPOSE_FILE) logs -f

# Show status of all containers
status:
	@echo "$(GREEN)Container Status:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps

# ===========================================
# CS1 SERVER COMMANDS
# ===========================================

cs1-restart:
	@echo "$(GREEN)Restarting CS1 server...$(NC)"
	@docker exec -u linuxgsm $(CS1_CONTAINER) ./csserver restart
	@echo "$(GREEN)✓ CS1 server restarted$(NC)"

cs1-details:
	@echo "$(GREEN)Getting CS1 Server Details...$(NC)"
	@docker exec -u linuxgsm $(CS1_CONTAINER) ./csserver details

cs1-start:
	@echo "$(GREEN)Starting CS1 server...$(NC)"
	@docker exec -u linuxgsm $(CS1_CONTAINER) ./csserver start
	@echo "$(GREEN)✓ CS1 server started$(NC)"

cs1-stop:
	@echo "$(YELLOW)Stopping CS1 server...$(NC)"
	@docker exec -u linuxgsm $(CS1_CONTAINER) ./csserver stop
	@echo "$(GREEN)✓ CS1 server stopped$(NC)"

cs1-logs:
	@echo "$(GREEN)CS1 Container Logs:$(NC)"
	@docker logs -f $(CS1_CONTAINER)

cs1-shell:
	@echo "$(GREEN)Accessing CS1 container shell...$(NC)"
	@docker exec -it -u linuxgsm $(CS1_CONTAINER) /bin/bash

# ===========================================
# CS2 SERVER COMMANDS
# ===========================================

cs2-restart:
	@echo "$(GREEN)Restarting CS2 server...$(NC)"
	@docker exec -u linuxgsm $(CS2_CONTAINER) ./csserver restart
	@echo "$(GREEN)✓ CS2 server restarted$(NC)"

cs2-details:
	@echo "$(GREEN)Getting CS2 Server Details...$(NC)"
	@docker exec -u linuxgsm $(CS2_CONTAINER) ./csserver details

cs2-start:
	@echo "$(GREEN)Starting CS2 server...$(NC)"
	@docker exec -u linuxgsm $(CS2_CONTAINER) ./csserver start
	@echo "$(GREEN)✓ CS2 server started$(NC)"

cs2-stop:
	@echo "$(YELLOW)Stopping CS2 server...$(NC)"
	@docker exec -u linuxgsm $(CS2_CONTAINER) ./csserver stop
	@echo "$(GREEN)✓ CS2 server stopped$(NC)"

cs2-logs:
	@echo "$(GREEN)CS2 Container Logs:$(NC)"
	@docker logs -f $(CS2_CONTAINER)

cs2-shell:
	@echo "$(GREEN)Accessing CS2 container shell...$(NC)"
	@docker exec -it -u linuxgsm $(CS2_CONTAINER) /bin/bash

# ===========================================
# DAEMON COMMANDS
# ===========================================

daemon-restart:
	@echo "$(GREEN)Restarting daemon container...$(NC)"
	@docker restart $(DAEMON_CONTAINER)
	@echo "$(GREEN)✓ Daemon container restarted$(NC)"

daemon-logs:
	@echo "$(GREEN)Daemon Container Logs:$(NC)"
	@docker logs -f $(DAEMON_CONTAINER)

daemon-shell:
	@echo "$(GREEN)Accessing daemon container shell...$(NC)"
	@docker exec -it $(DAEMON_CONTAINER) /bin/bash

# ===========================================
# DATABASE COMMANDS
# ===========================================

db-reset:
	@echo "$(YELLOW)Restarting database server...$(NC)"
	@docker restart $(DB_CONTAINER)
	@echo "$(GREEN)✓ Database server restarted$(NC)"

db-logs:
	@echo "$(GREEN)Database Container Logs:$(NC)"
	@docker logs -f $(DB_CONTAINER)

db-shell:
	@echo "$(GREEN)Accessing database container shell...$(NC)"
	@docker exec -it $(DB_CONTAINER) /bin/bash

db-backup:
	@echo "$(GREEN)Creating database backup...$(NC)"
	@mkdir -p ./backups
	@docker exec $(DB_CONTAINER) mysqldump -u root -proot hlstatsnext > ./backups/hlstatsnext_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backup created in ./backups/$(NC)"

# ===========================================
# UTILITY COMMANDS
# ===========================================

# Clean up stopped containers and unused images
clean:
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	@docker container prune -f
	@docker image prune -f
	@echo "$(GREEN)✓ Docker cleanup completed$(NC)"

# Remove all unused Docker resources (more aggressive)
prune:
	@echo "$(RED)WARNING: This will remove all unused Docker resources!$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to cancel, or Enter to continue...$(NC)"
	@read -r
	@docker system prune -a -f --volumes
	@echo "$(GREEN)✓ Docker system pruned$(NC)"
