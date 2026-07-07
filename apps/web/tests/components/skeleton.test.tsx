import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('renders with default shimmer effect', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild;
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('shimmer');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-16 w-full" />);
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('h-16', 'w-full');
  });
});
