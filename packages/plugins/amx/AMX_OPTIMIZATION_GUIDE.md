# AMX Mod X Plugin Optimization Guide

## Understanding std::bad_alloc in AMX Mod X Context

### Root Cause Analysis

During development of the HLStatsNext plugin, we encountered `std::bad_alloc` compiler crashes when using large enum structures (`EventData`). This document outlines the technical reasons behind this issue and provides optimization strategies.

### What Causes std::bad_alloc in AMX Plugins?

1. **Memory Fragmentation**: Even when heap memory is available, fragmentation prevents allocation of large contiguous blocks
2. **Stack Overflow**: AMX Mod X has a default stack/heap size of 16KB (16,384 bytes)
3. **Large Structure Initialization**: PAWN compiler generates code to manually zero every byte of large arrays/structures
4. **Enum Structure Overhead**: Large enum structures with multiple arrays create massive stack allocations

### Technical Details

```pawn
// PROBLEMATIC - Causes std::bad_alloc
enum EventData {
    player_name[32],     // 32 * 4 = 128 bytes
    killer_name[32],     // 32 * 4 = 128 bytes
    victim_name[32],     // 32 * 4 = 128 bytes
    // ... many more fields
    message[192]         // 192 * 4 = 768 bytes
}
// Total: ~2KB+ per structure, multiplied by usage frequency
```

When functions receive `data[EventData]` parameters, the compiler:

1. Allocates stack space for the entire structure
2. Generates zeroing code for every byte
3. Multiplies overhead in frequently-called functions

## Optimization Strategies

### 1. Global Variables Pattern

**Before (Problematic):**

```pawn
stock process_event(data[EventData]) {
    // Large stack allocation per call
    data[player_name] = "value";
}
```

**After (Optimized):**

```pawn
// Global variables - allocated once
new g_player_name[32];
new g_killer_name[32];
new g_victim_name[32];

stock process_event() {
    // Direct global access - no stack allocation
    copy(g_player_name, charsmax(g_player_name), "value");
}
```

### 2. Memory Management Directives

```pawn
// Increase available memory when absolutely necessary
#pragma dynamic 32768  // 128KB instead of default 16KB

// Alternative: Use semicolon to reduce memory usage
#pragma semicolon 1
```

### 3. Performance Optimization Patterns

#### Array Access Optimization

```pawn
// SLOW - Multiple array indexing
for (new i = 0; i < max_players; i++) {
    if (players[i] > threshold && players[i] < limit) {
        process_player(players[i]);
    }
}

// FAST - Cache array values
for (new i = 0; i < max_players; i++) {
    new player_value = players[i];
    if (player_value > threshold && player_value < limit) {
        process_player(player_value);
    }
}
```

#### Global vs Local Arrays

```pawn
// EXPENSIVE - Zeroing overhead in frequently called functions
public server_frame() {
    new temp_array[1024];  // 4KB zeroing operation every frame!
    // ... processing
}

// EFFICIENT - Global allocation
new g_temp_array[1024];  // Allocated once, zero overhead

public server_frame() {
    // Direct global access
    // ... processing
}
```

## Best Practices for AMX Plugin Development

### 1. Memory Allocation Guidelines

- **Use global variables** for large data structures accessed frequently
- **Avoid large local arrays** in functions called often (server_frame, client events)
- **Consider re-entrancy** when using globals/statics
- **Use `#pragma dynamic`** sparingly and only when necessary

### 2. Data Structure Design

```pawn
// GOOD - Small, focused structures
enum PlayerInfo {
    player_id,
    player_skill,
    Float:player_kdr
}

// BETTER - Individual globals for frequently accessed data
new g_player_ids[MAX_PLAYERS];
new g_player_skills[MAX_PLAYERS];
new Float:g_player_kdrs[MAX_PLAYERS];
```

### 3. String Handling Optimization

```pawn
// INEFFICIENT - Multiple string copies in data section
format(msg, charsmax(msg), "Player %s connected", name);
format(msg2, charsmax(msg2), "Player %s disconnected", name);

// EFFICIENT - Reuse format strings
new const PLAYER_CONNECT_MSG[] = "Player %s connected";
new const PLAYER_DISCONNECT_MSG[] = "Player %s disconnected";
format(msg, charsmax(msg), PLAYER_CONNECT_MSG, name);
```

### 4. Function Design Patterns

```pawn
// PATTERN 1: Global data processing
new g_event_steam_id[32];
new g_event_player_id;
new g_event_rank;

stock process_rank_event() {
    // Read directly into globals
    read_argv(3, g_event_steam_id, charsmax(g_event_steam_id));
    // Process using globals
    handle_rank_display();
}

// PATTERN 2: Minimal parameter passing
stock handle_rank_display() {
    // Use globals directly - no parameter overhead
    new player = find_player_by_steamid(g_event_steam_id);
    display_rank(player, g_event_rank);
}
```

### 5. Loop and Conditional Optimization

```pawn
// Cache expensive function calls
new max_players = get_maxplayers();
for (new i = 1; i <= max_players; i++) {
    // ... processing
}

// Use switch for multiple conditions
switch (event_type) {
    case EVT_RANK: process_rank();
    case EVT_STATS: process_stats();
    default: log_error("Unknown event");
}
```

## Debugging Memory Issues

### 1. Compilation Errors to Watch For

- `std::bad_alloc` - Memory allocation failure
- `AMX_ERR_STACKERR` - Stack overflow
- `error 017: undefined symbol` - Missing includes after optimization

### 2. Memory Usage Analysis

```pawn
// Check compilation output for memory usage
// Header size:           1016 bytes
// Code size:            16848 bytes
// Data size:            12336 bytes
// Stack/heap size:      16384 bytes  // Default limit
// Total requirements:   46584 bytes
```

### 3. Performance Profiling

- Monitor function call frequency
- Identify memory allocation hotspots
- Use logging to track memory-intensive operations

## Migration Strategy from Large Structures

### Step 1: Identify Large Structures

```pawn
enum EventData {
    // Count total memory usage
    // Each field * 4 bytes (32-bit) or 8 bytes (64-bit)
}
```

### Step 2: Convert to Globals

```pawn
// Replace enum fields with individual globals
new g_field1;
new g_field2[32];
```

### Step 3: Update Function Signatures

```pawn
// Before
stock process_event(data[EventData]) { }

// After
stock process_event() {
    // Access globals directly
}
```

### Step 4: Test and Validate

- Compile successfully without std::bad_alloc
- Verify functionality remains intact
- Monitor performance improvements

## Tools and Utilities

### Compilation Commands

```bash
# Standard compilation
./amxxpc plugin.sma -o plugin.amxx

# With include path
./amxxpc plugin.sma -iinclude -o plugin.amxx

# Memory debugging
./amxxpc plugin.sma -d2 -o plugin.amxx
```

### Memory Directives

```pawn
#pragma dynamic 32768    // Increase stack to 128KB
#pragma semicolon 1      // Reduce memory usage
#pragma compress 1       // Enable compression
```

## Conclusion

The std::bad_alloc errors in AMX Mod X are primarily caused by large structure allocations exceeding the default 16KB memory limit. The solution involves:

1. **Using global variables** instead of large enum structures
2. **Optimizing function parameters** to avoid stack allocations
3. **Following AMX-specific patterns** for memory management
4. **Testing thoroughly** after structural changes

This optimization approach not only resolves compilation issues but also improves runtime performance by eliminating unnecessary memory allocations and zeroing operations.

## References

- [AMX Mod X Optimization Guide](<https://wiki.alliedmods.net/Optimizing_Plugins_(AMX_Mod_X_Scripting)>)
- [PAWN Language Reference](https://www.compuphase.com/pawn/pawn.htm)
- [AlliedModders Wiki](https://wiki.alliedmods.net/)
