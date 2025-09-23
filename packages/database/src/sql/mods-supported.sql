--
-- Dumping data for table `Mods_Defaults`
--

INSERT INTO `mods_defaults` (`code`, `parameter`, `value`) VALUES
('', 'BroadCastEventsCommand', ''),
('AMXX', 'BroadCastEventsCommand', 'hlx_event'),
('BEETLE', 'BroadCastEventsCommand', 'hlx_event'),
('MANI', 'BroadCastEventsCommand', 'ma_hlx_psay'),
('MINISTATS', 'BroadCastEventsCommand', 'ms_psay'),
('SOURCEMOD', 'BroadCastEventsCommand', 'hlx_sm_psay'),
('', 'BroadCastEventsCommandAnnounce', 'say'),
('AMXX', 'BroadCastEventsCommandAnnounce', 'hlx_event'),
('BEETLE', 'BroadCastEventsCommandAnnounce', 'hlx_csay'),
('MANI', 'BroadCastEventsCommandAnnounce', 'ma_hlx_csay'),
('MINISTATS', 'BroadCastEventsCommandAnnounce', 'ms_csay'),
('SOURCEMOD', 'BroadCastEventsCommandAnnounce', 'hlx_sm_csay'),
('', 'PlayerEventsAdminCommand', ''),
('AMXX', 'PlayerEventsAdminCommand', 'amx_chat'),
('BEETLE', 'PlayerEventsAdminCommand', 'admin_chat'),
('MANI', 'PlayerEventsAdminCommand', 'ma_chat'),
('MINISTATS', 'PlayerEventsAdminCommand', ''),
('SOURCEMOD', 'PlayerEventsAdminCommand', 'sm_chat'),
('', 'PlayerEventsCommand', ''),
('AMXX', 'PlayerEventsCommand', 'hlx_event'),
('BEETLE', 'PlayerEventsCommand', 'hlx_psay'),
('MANI', 'PlayerEventsCommand', 'ma_hlx_psay'),
('MINISTATS', 'PlayerEventsCommand', 'ms_psay'),
('SOURCEMOD', 'PlayerEventsCommand', 'hlx_sm_psay'),
('', 'PlayerEventsCommandOSD', ''),
('AMXX', 'PlayerEventsCommandOSD', 'hlx_event'),
('BEETLE', 'PlayerEventsCommandOSD', 'hlx_msay'),
('MANI', 'PlayerEventsCommandOSD', 'ma_hlx_msay'),
('MINISTATS', 'PlayerEventsCommandOSD', 'ms_msay'),
('SOURCEMOD', 'PlayerEventsCommandOSD', 'hlx_sm_msay'),
('', 'PlayerEventsCommandHint', ''),
('AMXX', 'PlayerEventsCommandHint', 'hlx_event'),
('BEETLE', 'PlayerEventsCommandHint', ''),
('MANI', 'PlayerEventsCommandHint', 'ma_hlx_hint'),
('MINISTATS', 'PlayerEventsCommandHint', ''),
('SOURCEMOD', 'PlayerEventsCommandHint', 'hlx_sm_hint');

--
-- Dumping data for table `Mods_Supported`
--

INSERT INTO `mods_supported` (`code`, `name`) VALUES
('', '(none)'),
('SOURCEMOD', 'Sourcemod'),
('MANI', 'Mani Admin Mod >= 1.2'),
('BEETLE', 'BeetlesMod'),
('MINISTATS', 'MiniStats'),
('AMXX', 'AMX Mod X');
