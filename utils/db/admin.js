// utils/db/admin.js — Painel de administração: papéis, PIN, usuários, backups, auditoria, avisos do sistema e denúncias.
export class AdminMethods {
  // ── ADMIN AUTHORITY ────────────────────────────────────────────────────────
  async isAdmin() {
    if (this.isProxyMode) return this._proxy('isAdmin', []);
    try {
      const res = await this._fetch('admin_users?select=user_id&limit=1');
      return Array.isArray(res) && res.length > 0;
    } catch {
      return false;
    }
  }

  _getAdminSessionToken() {
    if (this._adminSessionToken) return this._adminSessionToken;
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem('lf_admin_token') || null;
      }
    } catch {}
    return null;
  }

  async adminVerifyPin(pinHash) {
    if (this.isProxyMode) return this._proxy('adminVerifyPin', [pinHash]);
    try {
      const res = await this._fetch('rpc/admin_verify_pin', {
        method: 'POST',
        body: { p_pin_hash: pinHash },
      });
      if (res && res.ok && res.session_token) {
        this._adminSessionToken = res.session_token;
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('lf_admin_token', res.session_token);
          }
        } catch {}
        return { ok: true, session_token: res.session_token };
      }
      return {
        ok: false,
        locked: Boolean(res?.locked),
        message: res?.message || 'Senha incorreta.',
      };
    } catch (err) {
      return { ok: false, error: err?.message || 'Erro ao validar senha.' };
    }
  }

  async adminGetRole() {
    if (this.isProxyMode) return this._proxy('adminGetRole', []);
    try {
      const res = await this._fetch('admin_users?select=role&limit=1');
      return Array.isArray(res) && res.length > 0 ? (res[0].role || 'admin') : null;
    } catch {
      return null;
    }
  }

  // Todas as RPCs administrativas exigem o token de sessão (PIN) e validam papel no servidor.
  _adminRpc(fn, params = {}) {
    return this._fetch(`rpc/${fn}`, {
      method: 'POST',
      body: { p_session_token: this._getAdminSessionToken(), ...params },
    });
  }

  async adminGetOverview() {
    if (this.isProxyMode) return this._proxy('adminGetOverview', []);
    return await this._adminRpc('admin_get_overview') || {};
  }

  async adminUsersPage({ search = null, filter = 'all', limit = 25, offset = 0 } = {}) {
    if (this.isProxyMode) return this._proxy('adminUsersPage', [{ search, filter, limit, offset }]);
    return await this._adminRpc('admin_users_page', {
      p_search: search || null, p_filter: filter, p_limit: limit, p_offset: offset,
    }) || { total: 0, rows: [] };
  }

  async adminGetUserDetail(targetUserId) {
    if (this.isProxyMode) return this._proxy('adminGetUserDetail', [targetUserId]);
    return await this._adminRpc('admin_get_user_detail', { p_target_user_id: targetUserId });
  }

  async adminExportUserData(targetUserId) {
    if (this.isProxyMode) return this._proxy('adminExportUserData', [targetUserId]);
    return await this._adminRpc('admin_export_user_data', { p_target_user_id: targetUserId });
  }

  async adminResetUserData(targetUserId, scopes, { dryRun = true, backup = true } = {}) {
    if (this.isProxyMode) return this._proxy('adminResetUserData', [targetUserId, scopes, { dryRun, backup }]);
    if (!dryRun) this._invalidateReadCache();
    return await this._adminRpc('admin_reset_user_data', {
      p_target_user_id: targetUserId, p_scopes: scopes, p_dry_run: dryRun, p_make_backup: backup,
    });
  }

  async adminResetAllUsersData(scopes, { dryRun = true, confirmPhrase = null } = {}) {
    if (this.isProxyMode) return this._proxy('adminResetAllUsersData', [scopes, { dryRun, confirmPhrase }]);
    if (!dryRun) this._invalidateReadCache();
    return await this._adminRpc('admin_reset_all_users_data', {
      p_scopes: scopes, p_dry_run: dryRun, p_confirm_phrase: confirmPhrase,
    });
  }

  async adminListBackups(targetUserId = null) {
    if (this.isProxyMode) return this._proxy('adminListBackups', [targetUserId]);
    return await this._adminRpc('admin_list_backups', { p_user: targetUserId }) || [];
  }

  async adminRestoreBackup(backupId) {
    if (this.isProxyMode) return this._proxy('adminRestoreBackup', [backupId]);
    this._invalidateReadCache();
    return await this._adminRpc('admin_restore_backup', { p_backup_id: backupId });
  }

  async adminDeleteBackup(backupId) {
    if (this.isProxyMode) return this._proxy('adminDeleteBackup', [backupId]);
    return await this._adminRpc('admin_delete_backup', { p_backup_id: backupId });
  }

  async adminSetUserSuspended(targetUserId, suspended, reason = null) {
    if (this.isProxyMode) return this._proxy('adminSetUserSuspended', [targetUserId, suspended, reason]);
    return await this._adminRpc('admin_set_user_suspended', {
      p_target_user_id: targetUserId, p_suspended: suspended, p_reason: reason,
    });
  }

  async adminRevokeUserSessions(targetUserId) {
    if (this.isProxyMode) return this._proxy('adminRevokeUserSessions', [targetUserId]);
    return await this._adminRpc('admin_revoke_user_sessions', { p_target_user_id: targetUserId });
  }

  async adminDeleteUser(targetUserId) {
    if (this.isProxyMode) return this._proxy('adminDeleteUser', [targetUserId]);
    this._invalidateReadCache();
    return await this._adminRpc('admin_delete_user', { p_target_user_id: targetUserId });
  }

  async adminListErrors({ limit = 50, userId = null } = {}) {
    if (this.isProxyMode) return this._proxy('adminListErrors', [{ limit, userId }]);
    return await this._adminRpc('admin_list_errors', { p_limit: limit, p_user: userId }) || { groups: [], recent: [] };
  }

  async adminClearErrors() {
    if (this.isProxyMode) return this._proxy('adminClearErrors', []);
    return await this._adminRpc('admin_clear_client_errors');
  }

  async adminApiUsage(days = 7) {
    if (this.isProxyMode) return this._proxy('adminApiUsage', [days]);
    return await this._adminRpc('admin_api_usage', { p_days: days }) || {};
  }

  async adminListAudit({ limit = 50, offset = 0, action = null, userId = null } = {}) {
    if (this.isProxyMode) return this._proxy('adminListAudit', [{ limit, offset, action, userId }]);
    return await this._adminRpc('admin_list_audit', {
      p_limit: limit, p_offset: offset, p_action: action || null, p_target: userId,
    }) || { total: 0, rows: [] };
  }

  async adminListAdmins() {
    if (this.isProxyMode) return this._proxy('adminListAdmins', []);
    return await this._adminRpc('admin_list_admins') || [];
  }

  async adminSetAdminRole(targetUserId, role) {
    if (this.isProxyMode) return this._proxy('adminSetAdminRole', [targetUserId, role]);
    return await this._adminRpc('admin_set_admin_role', { p_target_user_id: targetUserId, p_role: role });
  }

  async adminGetSystemNotice() {
    if (this.isProxyMode) return this._proxy('adminGetSystemNotice', []);
    return await this._adminRpc('admin_get_system_notice') || { active: false, message: '', level: 'info' };
  }

  async adminSetSystemNotice({ message, level = 'info', active = true }) {
    if (this.isProxyMode) return this._proxy('adminSetSystemNotice', [{ message, level, active }]);
    return await this._adminRpc('admin_set_system_notice', { p_message: message, p_level: level, p_active: active });
  }

  async getSystemNotice() {
    if (this.isProxyMode) return this._proxy('getSystemNotice', []);
    try {
      const res = await this._fetch('rpc/get_system_notice', { method: 'POST', body: {} });
      return res && res.active ? res : null;
    } catch {
      return null;
    }
  }

  async submitUserReport({ kind, message, route = '', appVersion = '', userAgent = '' }) {
    if (this.isProxyMode) return this._proxy('submitUserReport', [{ kind, message, route, appVersion, userAgent }]);
    return await this._fetch('rpc/submit_user_report', {
      method: 'POST',
      body: {
        p_kind: kind, p_message: message, p_route: route || null,
        p_app_version: appVersion || null, p_user_agent: userAgent || null,
      },
    });
  }

  async listMyReports() {
    if (this.isProxyMode) return this._proxy('listMyReports', []);
    return await this._fetch('user_reports?select=id,kind,message,status,admin_note,created_at&order=created_at.desc&limit=10') || [];
  }

  async adminSessionHygiene(days = 30) {
    if (this.isProxyMode) return this._proxy('adminSessionHygiene', [days]);
    return await this._adminRpc('admin_session_hygiene', { p_days: days }) || { total: 0, stale: 0, days };
  }

  async adminPruneStaleSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('adminPruneStaleSessions', [days]);
    return await this._adminRpc('admin_prune_stale_sessions', { p_days: days });
  }

  // Resumo para o selo do menu: só exige ser administrador (sem PIN) e devolve contagens, nunca dados.
  async adminAlertSummary() {
    if (this.isProxyMode) return this._proxy('adminAlertSummary', []);
    try {
      return await this._fetch('rpc/admin_alert_summary', { method: 'POST', body: {} });
    } catch {
      return { admin: false };
    }
  }

  async adminSecurityOverview() {
    if (this.isProxyMode) return this._proxy('adminSecurityOverview', []);
    return await this._adminRpc('admin_security_overview') || {};
  }

  async adminListReports({ status = null, kind = null, limit = 50, offset = 0 } = {}) {
    if (this.isProxyMode) return this._proxy('adminListReports', [{ status, kind, limit, offset }]);
    return await this._adminRpc('admin_list_reports', {
      p_status: status || null, p_kind: kind || null, p_limit: limit, p_offset: offset,
    }) || { counts: {}, total: 0, rows: [] };
  }

  async adminUpdateReport(reportId, status, note = null) {
    if (this.isProxyMode) return this._proxy('adminUpdateReport', [reportId, status, note]);
    return await this._adminRpc('admin_update_report', { p_report_id: reportId, p_status: status, p_note: note });
  }
}
