import { useEffect, useRef, useState } from 'react'
import { settingsService } from '../services/settingsService.js'

export default function useSettings() {
  const [state, setState] = useState({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState({})
  const [errors, setErrors] = useState({})
  const lifecycle = useRef(null)
  const writes = useRef(new Map())
  useEffect(() => {
    const controller = new AbortController(); lifecycle.current = controller
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try { const data = await settingsService.getSettings({ signal: controller.signal }); if (!controller.signal.aborted) setState({ status: 'loaded', data }) }
      catch (error) { if (!controller.signal.aborted) setState({ status: error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error', data: null }) }
    })
    return () => controller.abort()
  }, [attempt])
  const retry = () => { lifecycle.current?.abort(); writes.current.clear(); setPending({}); setErrors({}); setState({ status: 'loading', data: null }); setAttempt(value => value + 1) }
  const mutate = async (key, capability, operation, apply) => {
    const controller = lifecycle.current
    if (!controller || controller.signal.aborted || state.status !== 'loaded' || !state.data.capabilities[capability] || writes.current.has(key)) return false
    writes.current.set(key, controller); setPending(value => ({ ...value, [key]: true })); setErrors(value => ({ ...value, [key]: '' }))
    try {
      const result = await operation({ enabled: true, signal: controller.signal })
      if (controller.signal.aborted) return false
      setState(value => apply(value, result))
      return true
    } catch {
      if (!controller.signal.aborted) setErrors(value => ({ ...value, [key]: 'Could not confirm this update. Showing the last confirmed settings. Retry or reload before resubmitting.' }))
      return false
    } finally { if (writes.current.get(key) === controller) writes.current.delete(key); if (!controller.signal.aborted) setPending(value => ({ ...value, [key]: false })) }
  }
  const patchSection = (section, payload, result) => current => ({ ...current, data: { ...current.data, [section]: { ...current.data[section], ...Object.fromEntries(Object.keys(payload).map(key => [key, result[key]])) } } })
  const updateProfile = payload => mutate('profile', 'profileWrite', options => settingsService.updateProfile(payload, options), (value, result) => patchSection('profile', payload, result)(value))
  const updatePreferences = payload => mutate('preferences', 'preferencesWrite', options => settingsService.updateStudyPreferences(payload, options), (value, result) => patchSection('studyPreferences', payload, result)(value))
  const updateNotification = (key, next) => {
    const values = state.data?.notifications
    if (!values || typeof values[key] !== 'boolean' || key === 'email' && values.emailSupported !== true || key === 'whatsapp' && values.whatsappSupported !== true) return false
    const payload = { [key]: next }
    return mutate(`notification:${key}`, 'notificationsWrite', options => settingsService.updateNotificationPreferences(payload, options), (value, result) => patchSection('notifications', payload, result)(value))
  }
  const uploadAvatar = file => mutate('avatar', 'avatarUpload', options => settingsService.uploadAvatar(file, options), (value, result) => ({ ...value, data: { ...value.data, profile: { ...value.data.profile, avatarUrl: result } } }))
  const changePassword = payload => mutate('password', 'passwordChange', options => settingsService.changePassword(payload, options), value => value)
  const deleteAccount = async () => { const ok = await mutate('deletion', 'accountDeletion', options => settingsService.deleteAccount({ confirmation: 'DELETE' }, options), () => ({ status: 'deleted', data: null })); if (ok) lifecycle.current?.abort(); return ok }
  return { ...state, retry, pending, errors, updateProfile, updatePreferences, updateNotification, uploadAvatar, changePassword, deleteAccount }
}
