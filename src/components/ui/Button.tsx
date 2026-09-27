import { motion, type HTMLMotionProps } from 'framer-motion'
import { spring } from '@/lib/motion'
import { Icon, type IconName } from '../Icon'

type Variant = 'primary' | 'soft' | 'ghost' | 'quiet'
type Size = 'sm' | 'md'

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  children?: React.ReactNode
}

export function Button({
  variant = 'soft',
  size = 'md',
  icon,
  iconRight,
  children,
  className = '',
  ...rest
}: Props) {
  return (
    <motion.button
      type="button"
      className={`btn btn--${variant} btn--${size} ${!children ? 'btn--iconOnly' : ''} ${className}`}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.965, y: 0 }}
      transition={spring.snap}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} strokeWidth={1.9} />}
      {children && <span className="btn__label">{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} strokeWidth={1.9} />}
    </motion.button>
  )
}
