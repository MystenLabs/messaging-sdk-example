import { useUserSubname } from '../hooks/useUserSubname';
import { formatAddress } from '../utils/formatters';

interface AddressDisplayProps {
  address: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AddressDisplay({ address, className, style }: AddressDisplayProps) {
  const { subname, isLoading } = useUserSubname(address);

  if (isLoading) {
    return <span className={className} style={style}>{formatAddress(address)}</span>;
  }

  return <span className={className} style={style}>{subname || formatAddress(address)}</span>;
}
