export const formatMinutes = value => value >= 60 ? `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ''}` : `${value}m`
