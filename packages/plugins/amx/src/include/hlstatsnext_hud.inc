/*
 * HLStatsNext HUD Module
 *
 * Clean HUD announce commands for server/stats system
 */

#if defined _hlstatsnext_hud_included
  #endinput
#endif
#define _hlstatsnext_hud_included

#include "hlstatsnext_core.inc"
#include "hlstatsnext_globals.inc"

// HUD CVARs
new g_cvar_hlmsg_default_color;
new g_cvar_hlmsg_holdtime;
new g_cvar_hlmsg_fadein;
new g_cvar_hlmsg_fadeout;
new g_cvar_hlmsg_channel;

// HUD initialization
stock hlstatsnext_hud_init()
{
  g_cvar_hlmsg_default_color = register_cvar("hlmsg_default_color", "00FF80");
  g_cvar_hlmsg_holdtime      = register_cvar("hlmsg_holdtime", "3.0");
  g_cvar_hlmsg_fadein        = register_cvar("hlmsg_fadein", "1");
  g_cvar_hlmsg_fadeout       = register_cvar("hlmsg_fadeout", "0.6");
  g_cvar_hlmsg_channel       = register_cvar("hlmsg_channel", "-1");

  log_amx("%s HUD system initialized", HLSTATSNEXT_TAG);
}

// Simple color parsing for hex format only
stock bool:parse_color(const color_str[], &r, &g, &b)
{
  if (strlen(color_str) != 6)
  {
    return false;
  }

  new hex_val = 0;
  for (new i = 0; i < 6; i++)
  {
    new c = color_str[i];
    new digit;

    if (c >= '0' && c <= '9')
    {
      digit = c - '0';
    }
    else if (c >= 'A' && c <= 'F') {
      digit = c - 'A' + 10;
    }
    else if (c >= 'a' && c <= 'f') {
      digit = c - 'a' + 10;
    }
    else {
      return false;
    }

    hex_val = (hex_val << 4) | digit;
  }

  r = (hex_val >> 16) & 0xFF;
  g = (hex_val >> 8) & 0xFF;
  b = hex_val & 0xFF;

  return true;
}

// Get default color from CVAR
stock get_default_color(&r, &g, &b)
{
  new default_color[16];
  get_pcvar_string(g_cvar_hlmsg_default_color, default_color, charsmax(default_color));

  if (!parse_color(default_color, r, g, b))
  {
    r = 0;
    g = 255;
    b = 128;
  }
}

// HUD display functions
stock display_hud_csay(const message[], r, g, b)
{
  new Float:holdtime = get_pcvar_float(g_cvar_hlmsg_holdtime);
  new Float:fadein = get_pcvar_float(g_cvar_hlmsg_fadein);
  new Float:fadeout = get_pcvar_float(g_cvar_hlmsg_fadeout);
  new channel = get_pcvar_num(g_cvar_hlmsg_channel);

  set_hudmessage(r, g, b, -1.0, 0.20, 0, 0.0, holdtime, fadein, fadeout, channel);
  show_hudmessage(0, message);
}

stock display_hud_tsay(const message[], r, g, b)
{
  new Float:holdtime = get_pcvar_float(g_cvar_hlmsg_holdtime);
  new Float:fadein = get_pcvar_float(g_cvar_hlmsg_fadein);
  new Float:fadeout = get_pcvar_float(g_cvar_hlmsg_fadeout);
  new channel = get_pcvar_num(g_cvar_hlmsg_channel);

  set_hudmessage(r, g, b, 0.05, 0.70, 0, 0.0, holdtime, fadein, fadeout, channel);
  show_hudmessage(0, message);
}

stock display_hud_typehud(const message[], r, g, b)
{
  new Float:holdtime = get_pcvar_float(g_cvar_hlmsg_holdtime);
  new channel = get_pcvar_num(g_cvar_hlmsg_channel);
  new len = strlen(message);
  new Float:fxtime = float(len) / 25.0;

  if (fxtime < 0.5) fxtime = 0.5;
  if (fxtime > 4.0) fxtime = 4.0;

  set_hudmessage(r, g, b, -1.0, 0.65, 2, fxtime, holdtime, 0.15, 0.25, channel);
  show_hudmessage(0, message);
}