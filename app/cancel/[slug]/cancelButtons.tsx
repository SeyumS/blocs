'use client';
import React from 'react'
import { useState } from 'react';

type BookingData = {
  id: string
  series_id: string | null
}

type CancelButtonsProps = {
  data: BookingData
  slug: string
}

export const CancelButtons = ({ data, slug }: CancelButtonsProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCancelSingle = async () => {
    setIsLoading(true);
    const response = await fetch(`/api/cancel`, {
      method: 'POST',
      body: JSON.stringify({ id: data.id, mode: 'single', cancelledBy: 'client' }),
    });
    if (response.ok) {
      // A full navigation (not router.push) so CustomerView actually
      // remounts — otherwise its `status` state (e.g. 'booked') survives
      // from before the cancellation via the Router Cache.
      window.location.href = `/booklink/${slug}`;
    }
  }
  const handleCancelSeries = async () => {
    setIsLoading(true);
    const response = await fetch(`/api/cancel`, {
      method: 'POST',
      body: JSON.stringify({ id: data.id, mode: 'series', cancelledBy: 'client' }),
    });
    if (response.ok) {
      window.location.href = `/booklink/${slug}`;
    }
  }
  return (
    <div className="flex gap-2 flex-wrap">
      <button className="blocs-slot-action-danger" onClick={handleCancelSingle} disabled={isLoading}>
        {isLoading ? 'Cancelling...' : 'Cancel appointment'}
      </button>
      {data?.series_id && (
        <button className="blocs-slot-action-danger" onClick={handleCancelSeries} disabled={isLoading}>
          {isLoading ? 'Cancelling...' : 'Cancel series'}
        </button>
      )}
    </div>
  )
}
