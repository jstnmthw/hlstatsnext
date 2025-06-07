-- HLstatsX: CE Installation Database file

-- This file is only needed for new installations.

SET @DBVERSION="91";
SET @VERSION="1.11.6";

-- --------------------------------------------------------

--
-- Table structure for table `geoLiteCity_Blocks`
--

CREATE TABLE IF NOT EXISTS `geoLiteCity_Blocks` (
  `startIpNum` bigint(11) unsigned NOT NULL default '0',
  `endIpNum` bigint(11) unsigned NOT NULL default '0',
  `locId` bigint(11) unsigned NOT NULL default '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `geoLiteCity_Location`
--

CREATE TABLE IF NOT EXISTS `geoLiteCity_Location` (
  `locId` bigint(11) unsigned NOT NULL default '0',
  `country` varchar(2) NOT NULL,
  `region` varchar(50) default NULL,
  `city` varchar(50) default NULL,
  `postalCode` varchar(10) default NULL,
  `latitude` decimal(14,4) default NULL,
  `longitude` decimal(14,4) default NULL,
  PRIMARY KEY  (`locId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Actions`
--

CREATE TABLE IF NOT EXISTS `hlstats_Actions` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `game` varchar(32) NOT NULL default 'valve',
  `code` varchar(64) NOT NULL default '',
  `reward_player` int(11) NOT NULL default '10',
  `reward_team` int(11) NOT NULL default '0',
  `team` varchar(64) NOT NULL default '',
  `description` varchar(128) default NULL,
  `for_PlayerActions` enum('0','1') NOT NULL default '0',
  `for_PlayerPlayerActions` enum('0','1') NOT NULL default '0',
  `for_TeamActions` enum('0','1') NOT NULL default '0',
  `for_WorldActions` enum('0','1') NOT NULL default '0',
  `count` int(10) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `gamecode` (`code`,`game`,`team`),
  KEY `code` (`code`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Awards`
--

CREATE TABLE IF NOT EXISTS `hlstats_Awards` (
  `awardId` int(10) unsigned NOT NULL auto_increment,
  `awardType` CHAR( 1 ) NOT NULL DEFAULT 'W',
  `game` varchar(32) NOT NULL default 'valve',
  `code` varchar(128) NOT NULL default '',
  `name` varchar(128) NOT NULL default '',
  `verb` varchar(128) NOT NULL default '',
  `d_winner_id` int(10) unsigned default NULL,
  `d_winner_count` int(10) unsigned default NULL,
  `g_winner_id` int(10) unsigned default NULL,
  `g_winner_count` int(10) unsigned default NULL,  
  PRIMARY KEY  (`awardId`),
  UNIQUE KEY `code` (`game`,`awardType`,`code`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Clans`
--

CREATE TABLE IF NOT EXISTS `hlstats_Clans` (
  `clanId` int(10) unsigned NOT NULL auto_increment,
  `tag` varchar(64) NOT NULL default '',
  `name` varchar(128) NOT NULL default '',
  `homepage` varchar(64) NOT NULL default '',
  `game` varchar(32) NOT NULL default '',
  `hidden` tinyint(3) unsigned NOT NULL default '0',
  `mapregion` varchar(128) NOT NULL default '',
  PRIMARY KEY  (`clanId`),
  UNIQUE KEY `tag` (`game`,`tag`),
  KEY `game` (`game`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_ClanTags`
--

CREATE TABLE IF NOT EXISTS `hlstats_ClanTags` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `pattern` varchar(64) NOT NULL,
  `position` enum('EITHER','START','END') NOT NULL default 'EITHER',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `pattern` (`pattern`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Countries`
--

CREATE TABLE IF NOT EXISTS `hlstats_Countries` (
  `flag` varchar(16) NOT NULL,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY  (`flag`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Admin`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Admin` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `type` varchar(64) NOT NULL default 'Unknown',
  `message` varchar(255) NOT NULL default '',
  `playerName` varchar(64) NOT NULL default '',
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_ChangeName`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_ChangeName` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `oldName` varchar(64) NOT NULL default '',
  `newName` varchar(64) NOT NULL default '',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_ChangeRole`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_ChangeRole` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `role` varchar(64) NOT NULL default '',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_ChangeTeam`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_ChangeTeam` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `team` varchar(64) NOT NULL default '',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Chat`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Chat` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `message_mode` tinyint(2) NOT NULL default '0',
  `message` varchar(128) NOT NULL default '',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`),
  KEY `serverId` (`serverId`),
  FULLTEXT KEY `message` (`message`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Connects`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Connects` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `ipAddress` varchar(32) NOT NULL default '',
  `hostname` varchar(255) NOT NULL default '',
  `hostgroup` varchar(255) NOT NULL default '',
  `eventTime_Disconnect` datetime default NULL,
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Disconnects`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Disconnects` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Entries`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Entries` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Frags`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Frags` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `killerId` int(10) unsigned NOT NULL default '0',
  `victimId` int(10) unsigned NOT NULL default '0',
  `weapon` varchar(64) NOT NULL default '',
  `headshot` tinyint(1) NOT NULL default '0',
  `killerRole` varchar(64) NOT NULL default '',
  `victimRole` varchar(64) NOT NULL default '',
  `pos_x` MEDIUMINT default NULL,
  `pos_y` MEDIUMINT default NULL,
  `pos_z` MEDIUMINT default NULL,
  `pos_victim_x` MEDIUMINT default NULL,
  `pos_victim_y` MEDIUMINT default NULL,
  `pos_victim_z` MEDIUMINT default NULL,
  PRIMARY KEY  (`id`),
  KEY `killerId` (`killerId`),
  KEY `victimId` (`victimId`),
  KEY `serverId` (`serverId`),
  KEY `headshot` (`headshot`),
  KEY `map` (`map`(5)),
  KEY `weapon16` (`weapon`(16)),
  KEY `killerRole` (`killerRole`(8))
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Latency`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Latency` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `ping` int(32) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_PlayerActions`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_PlayerActions` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `actionId` int(10) unsigned NOT NULL default '0',
  `bonus` int(11) NOT NULL default '0',
  `pos_x` MEDIUMINT default NULL,
  `pos_y` MEDIUMINT default NULL,
  `pos_z` MEDIUMINT default NULL,
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`),
  KEY `actionId` (`actionId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_PlayerPlayerActions`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_PlayerPlayerActions` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `victimId` int(10) unsigned NOT NULL default '0',
  `actionId` int(10) unsigned NOT NULL default '0',
  `bonus` int(11) NOT NULL default '0',
  `pos_x` MEDIUMINT default NULL,
  `pos_y` MEDIUMINT default NULL,
  `pos_z` MEDIUMINT default NULL,
  `pos_victim_x` MEDIUMINT default NULL,
  `pos_victim_y` MEDIUMINT default NULL,
  `pos_victim_z` MEDIUMINT default NULL,
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`),
  KEY `actionId` (`actionId`),
	KEY `victimId` (`victimId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Rcon`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Rcon` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `type` varchar(6) NOT NULL default 'UNK',
  `remoteIp` varchar(32) NOT NULL default '',
  `password` varchar(128) NOT NULL default '',
  `command` varchar(255) NOT NULL default '',
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Statsme`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Statsme` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `weapon` varchar(64) NOT NULL default '',
  `shots` int(6) unsigned NOT NULL default '0',
  `hits` int(6) unsigned NOT NULL default '0',
  `headshots` int(6) unsigned NOT NULL default '0',
  `damage` int(6) unsigned NOT NULL default '0',
  `kills` int(6) unsigned NOT NULL default '0',
  `deaths` int(6) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`),
  KEY `weapon` (`weapon`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Statsme2`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Statsme2` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `weapon` varchar(64) NOT NULL default '',
  `head` int(6) unsigned NOT NULL default '0',
  `chest` int(6) unsigned NOT NULL default '0',
  `stomach` int(6) unsigned NOT NULL default '0',
  `leftarm` int(6) unsigned NOT NULL default '0',
  `rightarm` int(6) unsigned NOT NULL default '0',
  `leftleg` int(6) unsigned NOT NULL default '0',
  `rightleg` int(6) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`),
  KEY `weapon` (`weapon`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_StatsmeLatency`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_StatsmeLatency` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `ping` int(6) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_StatsmeTime`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_StatsmeTime` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `time` time NOT NULL default '00:00:00',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Suicides`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Suicides` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `weapon` varchar(64) NOT NULL default '',
  `pos_x` MEDIUMINT default NULL,
  `pos_y` MEDIUMINT default NULL,
  `pos_z` MEDIUMINT default NULL,
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_TeamBonuses`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_TeamBonuses` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `playerId` int(10) unsigned NOT NULL default '0',
  `actionId` int(10) unsigned NOT NULL default '0',
  `bonus` int(11) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `playerId` (`playerId`),
  KEY `actionId` (`actionId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Events_Teamkills`
--

CREATE TABLE IF NOT EXISTS `hlstats_Events_Teamkills` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `eventTime` datetime default NULL,
  `serverId` int(10) unsigned NOT NULL default '0',
  `map` varchar(64) NOT NULL default '',
  `killerId` int(10) unsigned NOT NULL default '0',
  `victimId` int(10) unsigned NOT NULL default '0',
  `weapon` varchar(64) NOT NULL default '',
  `pos_x` MEDIUMINT default NULL,
  `pos_y` MEDIUMINT default NULL,
  `pos_z` MEDIUMINT default NULL,
  `pos_victim_x` MEDIUMINT default NULL,
  `pos_victim_y` MEDIUMINT default NULL,
  `pos_victim_z` MEDIUMINT default NULL,
  PRIMARY KEY  (`id`),
  KEY `killerId` (`killerId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Games`
--

CREATE TABLE IF NOT EXISTS `hlstats_Games` (
  `code` varchar(32) NOT NULL default '',
  `name` varchar(128) NOT NULL default '',
  `hidden` enum('0','1') NOT NULL default '0',
  `realgame` varchar(32) NOT NULL default 'hl2mp',
  PRIMARY KEY  (`code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Games_Defaults`
--

CREATE TABLE IF NOT EXISTS `hlstats_Games_Defaults` (
  `code` varchar(32) NOT NULL,
  `parameter` varchar(50) NOT NULL,
  `value` varchar(128) NOT NULL,
  PRIMARY KEY  (`code`,`parameter`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Games_Supported`
--

CREATE TABLE IF NOT EXISTS `hlstats_Games_Supported` (
  `code` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  PRIMARY KEY  (`code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Heatmap_Config`
--

CREATE TABLE IF NOT EXISTS `hlstats_Heatmap_Config` (
  `id` int(255) NOT NULL auto_increment,
  `map` varchar(64) NOT NULL,
  `game` varchar(32) NOT NULL,
  `xoffset` float NOT NULL,
  `yoffset` float NOT NULL,
  `flipx` tinyint(1) NOT NULL default '0',
  `flipy` tinyint(1) NOT NULL default '1',
  `rotate` tinyint(1) NOT NULL default '0',
  `days` tinyint(4) NOT NULL default '30',
  `brush` varchar(5) NOT NULL default 'small',
  `scale` float NOT NULL,
  `font` tinyint(2) NOT NULL default '10',
  `thumbw` float NOT NULL default '0.170312',
  `thumbh` float NOT NULL default '0.170312',
  `cropx1` int(11) NOT NULL default '0',
  `cropy1` int(11) NOT NULL default '0',
  `cropx2` int(11) NOT NULL default '0',
  `cropy2` int(11) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `gamemap` (`map`, `game`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_HostGroups`
--

CREATE TABLE IF NOT EXISTS `hlstats_HostGroups` (
  `id` int(11) NOT NULL auto_increment,
  `pattern` varchar(255) NOT NULL default '',
  `name` varchar(255) NOT NULL default '',
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Livestats`
--

CREATE TABLE IF NOT EXISTS `hlstats_Livestats` (
  `player_id` int(10) NOT NULL default '0',
  `server_id` int(10) NOT NULL default '0',
  `cli_address` varchar(32) NOT NULL default '',
  `cli_city` varchar(64) NOT NULL default '',
  `cli_country` varchar(64) NOT NULL default '',
  `cli_flag` varchar(16) NOT NULL default '',
  `cli_state` varchar(64) NOT NULL default '',
  `cli_lat` FLOAT(7,4) NULL,
  `cli_lng` FLOAT(7,4) NULL,
  `steam_id` varchar(64) NOT NULL default '',
  `name` varchar(64) NOT NULL,
  `team` varchar(64) NOT NULL default '',
  `kills` int(6) NOT NULL default '0',
  `deaths` int(6) NOT NULL default '0',
  `suicides` int(6) NOT NULL default '0',
  `headshots` int(6) NOT NULL default '0',
  `shots` int(11) NOT NULL default '0',
  `hits` int(11) NOT NULL default '0',
  `is_dead` tinyint(1) NOT NULL default '0',
  `has_bomb` int(1) NOT NULL default '0',
  `ping` int(6) NOT NULL default '0',
  `connected` int(10) NOT NULL default '0',
  `skill_change` int(10) NOT NULL default '0',
  `skill` int(10) NOT NULL default '0',
  PRIMARY KEY  (`player_id`)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hlstats_Maps_Counts` (
  `rowId` int(11) NOT NULL auto_increment,
  `game` varchar(32) NOT NULL,
  `map` varchar(64) NOT NULL,
  `kills` int(11) NOT NULL,
  `headshots` int(11) NOT NULL,
  PRIMARY KEY  (`game`,`map`),
  INDEX ( `rowId` )
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hlstats_Mods_Defaults` (
  `code` varchar(32) NOT NULL,
  `parameter` varchar(50) NOT NULL,
  `value` varchar(128) NOT NULL,
  PRIMARY KEY  (`code`,`parameter`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Mods_Supported`
--

CREATE TABLE IF NOT EXISTS `hlstats_Mods_Supported` (
  `code` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  PRIMARY KEY  (`code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Options`
--

CREATE TABLE IF NOT EXISTS `hlstats_Options` (
  `keyname` varchar(32) NOT NULL default '',
  `value` varchar(128) NOT NULL default '',
  `opttype` TINYINT NOT NULL DEFAULT '1',
  PRIMARY KEY  (`keyname`),
  INDEX ( `opttype` )
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Options_Choices`
--

CREATE TABLE IF NOT EXISTS `hlstats_Options_Choices` (
  `keyname` varchar(32) NOT NULL,
  `value` varchar(128) NOT NULL,
  `text` varchar(128) NOT NULL default '',
  `isDefault` tinyint(1) NOT NULL default '0',
  PRIMARY KEY  (`keyname`,`value`),
  KEY `keyname` (`keyname`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `hlstats_PlayerNames`
--

CREATE TABLE IF NOT EXISTS `hlstats_PlayerNames` (
  `playerId` int(10) unsigned NOT NULL default '0',
  `name` varchar(64) NOT NULL default '',
  `lastuse` datetime default NULL,
  `connection_time` int(11) unsigned NOT NULL default '0',
  `numuses` int(10) unsigned NOT NULL default '0',
  `kills` int(11) unsigned NOT NULL default '0',
  `deaths` int(11) unsigned NOT NULL default '0',
  `suicides` int(11) unsigned NOT NULL default '0',
  `headshots` int(11) unsigned NOT NULL default '0',
  `shots` int(11) unsigned NOT NULL default '0',
  `hits` int(11) unsigned NOT NULL default '0',
  PRIMARY KEY  (`playerId`,`name`),
  KEY `name16` (`name`(16))
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

-- Table structure for table `hlstats_Players`
--

CREATE TABLE IF NOT EXISTS `hlstats_Players` (
  `playerId` int(10) unsigned NOT NULL auto_increment,
  `last_event` int(11) NOT NULL default '0',
  `connection_time` int(11) unsigned NOT NULL default '0',
  `lastName` varchar(64) NOT NULL default '',
  `lastAddress` varchar(32) NOT NULL default '',
  `city` varchar(64) NOT NULL default '',
  `state` varchar(64) NOT NULL default '',
  `country` varchar(64) NOT NULL default '',
  `flag` varchar(16) NOT NULL default '',
  `lat` FLOAT(7,4) NULL,
  `lng` FLOAT(7,4) NULL,
  `clan` int(10) unsigned NOT NULL default '0',
  `kills` int(11) unsigned NOT NULL default '0',
  `deaths` int(11) unsigned NOT NULL default '0',
  `suicides` int(11) unsigned NOT NULL default '0',
  `skill` int(11) unsigned NOT NULL default '1000',
  `shots` int(11) unsigned NOT NULL default '0',
  `hits` int(11) unsigned NOT NULL default '0',
  `teamkills` int(11) unsigned NOT NULL default '0',
  `fullName` varchar(128) default NULL,
  `email` varchar(64) default NULL,
  `homepage` varchar(64) default NULL,
  `icq` int(10) unsigned default NULL,
  `mmrank` tinyint(4) DEFAULT NULL,
  `game` varchar(32) NOT NULL,
  `hideranking` int(1) unsigned NOT NULL default '0',
  `headshots` int(10) unsigned NOT NULL default '0',
  `last_skill_change` int(11) NOT NULL default '0',
  `displayEvents` int(1) unsigned NOT NULL default '1',
  `kill_streak` int(6) NOT NULL default '0',
  `death_streak` int(6) NOT NULL default '0',
  `blockavatar` int(1) unsigned NOT NULL default '0',
  `activity` int(11) NOT NULL default '100',
  `createdate` int(11) NOT NULL default'0',
  PRIMARY KEY  (`playerId`),
  KEY `playerclan` (`clan`,`playerId`),
  KEY `skill` (`skill`),
  KEY `game` (`game`),
  KEY `kills` (`kills`),
  KEY `hideranking` (`hideranking`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Players_Awards`
--

CREATE TABLE IF NOT EXISTS `hlstats_Players_Awards` (
  `awardTime` date NOT NULL,
  `awardId` int(11) unsigned NOT NULL default '0',
  `playerId` int(11) unsigned NOT NULL default '0',
  `count` int(11) unsigned NOT NULL default '0',
  `game` varchar(32) NOT NULL,
  PRIMARY KEY  (`awardTime`,`awardId`,`playerId`,`game`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Players_History`
--

CREATE TABLE IF NOT EXISTS `hlstats_Players_History` (
  `playerId` int(10) unsigned NOT NULL default '0',
  `eventTime` date default NULL,
  `connection_time` int(10) unsigned NOT NULL default '0',
  `kills` int(11) unsigned NOT NULL default '0',
  `deaths` int(11) unsigned NOT NULL default '0',
  `suicides` int(11) unsigned NOT NULL default '0',
  `skill` int(11) unsigned NOT NULL default '1000',
  `shots` int(11) unsigned NOT NULL default '0',
  `hits` int(11) unsigned NOT NULL default '0',
  `game` varchar(32) NOT NULL default '',
  `headshots` int(11) unsigned NOT NULL default '0',
  `teamkills` int(11) unsigned NOT NULL default '0',
  `kill_streak` int(6) NOT NULL default '0',
  `death_streak` int(6) NOT NULL default '0',
  `skill_change` int(11) NOT NULL default '0',
  UNIQUE KEY `eventTime` (`eventTime`,`playerId`,`game`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Players_Ribbons`
--

CREATE TABLE IF NOT EXISTS `hlstats_Players_Ribbons` (
  `playerId` int(11) unsigned NOT NULL default '0',
  `ribbonId` int(11) unsigned NOT NULL default '0',
  `game` varchar(32) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_PlayerUniqueIds`
--

CREATE TABLE IF NOT EXISTS `hlstats_PlayerUniqueIds` (
  `playerId` int(10) unsigned NOT NULL default '0',
  `uniqueId` varchar(64) NOT NULL default '',
  `game` varchar(32) NOT NULL default '',
  `merge` int(10) unsigned default NULL,
  PRIMARY KEY  (`uniqueId`,`game`),
  KEY `playerId` (`playerId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Ranks`
--

CREATE TABLE IF NOT EXISTS `hlstats_Ranks` (
  `rankId` int(11) unsigned NOT NULL auto_increment,
  `image` varchar(30) NOT NULL,
  `minKills` int(11) unsigned NOT NULL default '0',
  `maxKills` int(11) NOT NULL default '0',
  `rankName` varchar(50) NOT NULL,
  `game` varchar(32) NOT NULL,
  PRIMARY KEY  (`rankId`),
  UNIQUE KEY `rankgame` (`image`,`game`),
  KEY `game` (`game`(8))
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Ribbons`
--

CREATE TABLE IF NOT EXISTS `hlstats_Ribbons` (
  `ribbonId` int(11) unsigned NOT NULL auto_increment,
  `awardCode` varchar(50) NOT NULL,
  `awardCount` int(11) NOT NULL default '0',
  `special` tinyint(3) NOT NULL default '0',
  `game` varchar(32) NOT NULL,
  `image` varchar(50) NOT NULL,
  `ribbonName` varchar(50) NOT NULL,
  PRIMARY KEY  (`ribbonId`),
  UNIQUE KEY `award` (`awardCode`,`awardCount`,`game`, `special`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Roles`
--

CREATE TABLE IF NOT EXISTS `hlstats_Roles` (
  `roleId` int(10) unsigned NOT NULL auto_increment,
  `game` varchar(32) NOT NULL default 'valve',
  `code` varchar(64) NOT NULL default '',
  `name` varchar(64) NOT NULL default '',
  `hidden` enum('0','1') NOT NULL default '0',
  `picked` int(6) unsigned NOT NULL default '0',
  `kills` int(6) unsigned NOT NULL default '0',
  `deaths` int(6) unsigned NOT NULL default '0',
  PRIMARY KEY  (`roleId`),
  UNIQUE KEY `gamecode` (`game`,`code`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Servers`
--

CREATE TABLE IF NOT EXISTS `hlstats_Servers` (
  `serverId` int(10) unsigned NOT NULL auto_increment,
  `address` varchar(32) NOT NULL default '',
  `port` int(5) unsigned NOT NULL default '0',
  `name` varchar(255) NOT NULL default '',
  `sortorder` tinyint NOT NULL default '0',
  `game` varchar(32) NOT NULL default 'valve',
  `publicaddress` varchar(128) NOT NULL default '',
  `statusurl` varchar(255) default NULL,
  `rcon_password` varchar(128) NOT NULL default '',
  `kills` int(10) NOT NULL default '0',
  `players` int(11) NOT NULL default '0',
  `rounds` int(10) NOT NULL default '0',
  `suicides` int(10) NOT NULL default '0',
  `headshots` int(10) NOT NULL default '0',
  `bombs_planted` int(10) NOT NULL default '0',
  `bombs_defused` int(10) NOT NULL default '0',
  `ct_wins` int(10) NOT NULL default '0',
  `ts_wins` int(10) NOT NULL default '0',
  `act_players` int(4) NOT NULL default '0',
  `max_players` int(4) NOT NULL default '0',
  `act_map` varchar(64) NOT NULL default '',
  `map_rounds` int(6) NOT NULL default '0',
  `map_ct_wins` int(10) NOT NULL default '0',
  `map_ts_wins` int(10) NOT NULL default '0',
  `map_started` int(10) NOT NULL default '0',
  `map_changes` int(10) NOT NULL default '0',
  `ct_shots` int(11) NOT NULL default '0',
  `ct_hits` int(11) NOT NULL default '0',
  `ts_shots` int(11) NOT NULL default '0',
  `ts_hits` int(11) NOT NULL default '0',
  `map_ct_shots` int(11) NOT NULL default '0',
  `map_ct_hits` int(11) NOT NULL default '0',
  `map_ts_shots` int(11) NOT NULL default '0',
  `map_ts_hits` int(11) NOT NULL default '0',
  `lat` FLOAT(7,4) NULL,
  `lng` FLOAT(7,4) NULL,
  `city` varchar(64) NOT NULL default '',
  `country` varchar(64) NOT NULL default '',
  `last_event` int(10) unsigned NOT NULL default '0',
  PRIMARY KEY  (`serverId`),
  UNIQUE KEY `addressport` (`address`,`port`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci PACK_KEYS=0;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Servers_Config`
--

CREATE TABLE IF NOT EXISTS `hlstats_Servers_Config` (
  `serverId` int(11) unsigned NOT NULL default '0',
  `parameter` varchar(50) NOT NULL,
  `value` varchar(128) NOT NULL,
  `serverConfigId` int(11) unsigned NOT NULL auto_increment,
  PRIMARY KEY  (`serverId`,`parameter`),
  KEY `serverConfigId` (`serverConfigId`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Servers_Config_Default`
--

CREATE TABLE IF NOT EXISTS `hlstats_Servers_Config_Default` (
  `parameter` varchar(50) NOT NULL,
  `value` varchar(128) NOT NULL,
  `description` mediumtext,
  PRIMARY KEY  (`parameter`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Servers_VoiceComm`
--

CREATE TABLE IF NOT EXISTS `hlstats_Servers_VoiceComm` (
  `serverId` int(11) unsigned NOT NULL auto_increment,
  `name` varchar(128) NOT NULL,
  `addr` varchar(128) NOT NULL,
  `password` varchar(128) default NULL,
  `descr` varchar(255) default NULL,
  `queryPort` int(11) unsigned NOT NULL default '51234',
  `UDPPort` int(11) unsigned NOT NULL default '8767',
  `serverType` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`serverId`),
  UNIQUE KEY `address` (`addr`,`UDPPort`,`queryPort`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_server_load`
--

CREATE TABLE IF NOT EXISTS `hlstats_server_load` (
  `server_id` int(10) NOT NULL default '0',
  `timestamp` int(11) NOT NULL default '0',
  `act_players` tinyint(2) NOT NULL default '0',
  `min_players` tinyint(2) NOT NULL default '0',
  `max_players` tinyint(2) NOT NULL default '0',
  `map` varchar(64) default NULL,
  `uptime` varchar(10) NOT NULL default '0',
  `fps` varchar(10) NOT NULL default '0',
  KEY `server_id` (`server_id`),
  KEY `timestamp` (`timestamp`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Teams`
--

CREATE TABLE IF NOT EXISTS `hlstats_Teams` (
  `teamId` int(10) unsigned NOT NULL auto_increment,
  `game` varchar(32) NOT NULL default 'valve',
  `code` varchar(64) NOT NULL default '',
  `name` varchar(64) NOT NULL default '',
  `hidden` enum('0','1') NOT NULL default '0',
  `playerlist_bgcolor` varchar(7) default NULL,
  `playerlist_color` varchar(7) default NULL,
  `playerlist_index` tinyint(3) unsigned NOT NULL default '0',
  PRIMARY KEY  (`teamId`),
  UNIQUE KEY `gamecode` (`game`,`code`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Trend`
--

CREATE TABLE IF NOT EXISTS `hlstats_Trend` (
  `timestamp` int(11) NOT NULL default '0',
  `game` varchar(32) NOT NULL default '',
  `players` int(11) NOT NULL default '0',
  `kills` int(11) NOT NULL default '0',
  `headshots` int(11) NOT NULL default '0',
  `servers` int(11) NOT NULL default '0',
  `act_slots` int(11) NOT NULL default '0',
  `max_slots` int(11) NOT NULL default '0',
  KEY `game` (`game`),
  KEY `timestamp` (`timestamp`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Users`
--

CREATE TABLE IF NOT EXISTS `hlstats_Users` (
  `username` varchar(16) NOT NULL default '',
  `password` varchar(32) NOT NULL default '',
  `acclevel` int(11) NOT NULL default '0',
  `playerId` int(11) NOT NULL default '0',
  PRIMARY KEY  (`username`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `hlstats_Users`
--

INSERT INTO `hlstats_Users` VALUES ('admin','e10adc3949ba59abbe56e057f20f883e',100,0);

-- --------------------------------------------------------

--
-- Table structure for table `hlstats_Weapons`
--

CREATE TABLE IF NOT EXISTS `hlstats_Weapons` (
  `weaponId` int(10) unsigned NOT NULL auto_increment,
  `game` varchar(32) NOT NULL default 'valve',
  `code` varchar(64) NOT NULL default '',
  `name` varchar(128) NOT NULL default '',
  `modifier` float(10,2) NOT NULL default '1.00',
  `kills` int(10) unsigned NOT NULL default '0',
  `headshots` int(10) unsigned NOT NULL default '0',
  PRIMARY KEY  (`weaponId`),
  UNIQUE KEY `gamecode` (`game`,`code`),
  KEY `code` (`code`),
  KEY `modifier` (`modifier`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
