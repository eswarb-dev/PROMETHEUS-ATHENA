export default function SettingsUnavailableState({ section }) {
  return <section className="settings-panel" role="status"><h2>{section ? `${section} unavailable` : 'Live account settings are not connected yet.'}</h2><p>{section ? 'These settings have not been provided by the account service.' : 'Connect the ATHENA backend to manage your profile and preferences.'}</p></section>
}
