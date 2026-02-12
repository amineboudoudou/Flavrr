import React, { useEffect, useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { api } from '../../lib/api';
import type { ReviewWithOrder, ReviewStatus } from '../../types';

export const Reviews: React.FC = () => {
    const [reviews, setReviews] = useState<ReviewWithOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
    const [stats, setStats] = useState({
        average_rating: 0,
        total_reviews: 0,
        pending_count: 0,
        approved_count: 0,
        rejected_count: 0,
    });

    useEffect(() => {
        fetchReviews();
    }, [filter]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const params = filter !== 'all' ? { status: filter as ReviewStatus } : undefined;
            const data = await api.listReviews(params);
            setReviews(data.reviews);
            setStats(data.stats);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (reviewId: string, status: ReviewStatus) => {
        try {
            await api.updateReviewStatus(reviewId, status);
            fetchReviews();
        } catch (error) {
            console.error('Error updating review:', error);
            alert('Failed to update review status');
        }
    };

    const renderStars = (rating: number) => {
        return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    return (
        <OwnerLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text mb-2">Reviews</h1>
                    <p className="text-muted">Manage customer reviews and feedback</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-surface border border-border rounded-[var(--radius)] p-4 shadow-[var(--shadow)]">
                        <div className="text-muted text-sm mb-1">Average Rating</div>
                        <div className="text-2xl font-bold text-text">{stats.average_rating.toFixed(1)}</div>
                        <div className="text-yellow-500 text-sm mt-1">{renderStars(Math.round(stats.average_rating))}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-[var(--radius)] p-4 shadow-[var(--shadow)]">
                        <div className="text-muted text-sm mb-1">Total Reviews</div>
                        <div className="text-2xl font-bold text-text">{stats.total_reviews}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-[var(--radius)] p-4 shadow-[var(--shadow)]">
                        <div className="text-muted text-sm mb-1">Pending</div>
                        <div className="text-2xl font-bold text-yellow-600">{stats.pending_count}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-[var(--radius)] p-4 shadow-[var(--shadow)]">
                        <div className="text-muted text-sm mb-1">Approved</div>
                        <div className="text-2xl font-bold text-green-600">{stats.approved_count}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-[var(--radius)] p-4 shadow-[var(--shadow)]">
                        <div className="text-muted text-sm mb-1">Rejected</div>
                        <div className="text-2xl font-bold text-red-600">{stats.rejected_count}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                    ? 'bg-primary text-white'
                                    : 'bg-surface text-muted hover:bg-surface-2 hover:text-text border border-border'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Reviews List */}
                {loading ? (
                    <div className="py-12">
                        <BrandedLoader message="Loading reviews…" />
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-12 text-muted">No reviews found</div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div
                                key={review.id}
                                className="bg-surface border border-border rounded-[var(--radius)] p-6 hover:bg-surface-2 transition-colors shadow-[var(--shadow)]"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                                                <span className="text-primary font-bold">
                                                    {review.customer_name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-text font-medium">{review.customer_name}</div>
                                                <div className="text-muted text-sm">
                                                    Order #{review.order?.order_number || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-yellow-500 mb-2">{renderStars(review.rating)}</div>
                                        {review.comment && (
                                            <p className="text-text mb-3">{review.comment}</p>
                                        )}
                                        <div className="text-muted text-sm">
                                            {new Date(review.created_at).toLocaleDateString()} at{' '}
                                            {new Date(review.created_at).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 ml-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${review.status === 'approved'
                                                    ? 'bg-green-500/10 text-green-700 border border-green-200'
                                                    : review.status === 'rejected'
                                                        ? 'bg-red-500/10 text-red-700 border border-red-200'
                                                        : 'bg-yellow-500/10 text-yellow-700 border border-yellow-200'
                                                }`}
                                        >
                                            {review.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                {review.status === 'pending' && (
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                                        <button
                                            onClick={() => handleUpdateStatus(review.id, 'approved')}
                                            className="px-4 py-2 bg-primary hover:bg-accent text-white rounded-[var(--radius)] font-medium transition-colors"
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(review.id, 'rejected')}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-[var(--radius)] font-medium transition-colors"
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
};
