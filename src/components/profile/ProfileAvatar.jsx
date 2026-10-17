import { useState } from 'react'

export default function ProfileAvatar({ name, imageUrl, size = 96 }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?'
  return <div className="profile-avatar" style={{ '--avatar-size': `${size}px` }}>
    {imageUrl && failedUrl !== imageUrl
      ? <img src={imageUrl} alt={`${name || 'User'}'s profile photo`} onError={() => setFailedUrl(imageUrl)} />
      : <span role="img" aria-label={`Profile avatar for ${name?.trim() || 'unnamed user'}`}>{initial}</span>}
  </div>
}
