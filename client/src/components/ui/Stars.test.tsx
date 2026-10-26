import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rating, Stars } from './Stars';

describe('Stars', () => {
  it('announces the rating and review count', () => {
    render(<Stars rating={4.6} count={3} />);
    expect(screen.getByRole('img', { name: 'Rated 4.6 out of 5 from 3 reviews' })).toBeInTheDocument();
  });

  it('uses the singular label for one review', () => {
    render(<Stars rating={5} count={1} />);
    expect(screen.getByRole('img', { name: 'Rated 5.0 out of 5 from 1 review' })).toBeInTheDocument();
  });
});

describe('Rating', () => {
  it('renders the numeric rating and review count', () => {
    render(<Rating rating={4.25} count={8} />);
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('(8 reviews)')).toBeInTheDocument();
  });

  it('hides the review count when asked', () => {
    render(<Rating rating={5} count={1} showCount={false} />);
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.queryByText('(1 review)')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no reviews', () => {
    render(<Rating rating={0} count={0} />);
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
