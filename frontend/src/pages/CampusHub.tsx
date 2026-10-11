import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Flame,
  Search,
  PlusCircle,
  ThumbsUp,
  Calendar,
  MapPin,
  Clock,
  Tag,
  CheckCircle,
  AlertCircle,
  User,
  Image as ImageIcon,
  Check,
  Star,
  Shield,
  HelpCircle,
  FileText
} from 'lucide-react';

interface CampusHubProps {
  currentUser: any;
  initialTab?: 'EVENTS' | 'LOST_FOUND';
  embedded?: boolean;
}

export const CampusHub: React.FC<CampusHubProps> = ({ currentUser, initialTab = 'EVENTS', embedded = false }) => {
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'LOST_FOUND'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // --------------------------------------------------------------------------
  // EVENTS STATE
  // --------------------------------------------------------------------------
  const [events, setEvents] = useState<any[]>([]);
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('ALL');
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const [showCreateEventModal, setShowCreateEventModal] = useState<boolean>(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    category: 'Technical',
    venue: '',
    eventDate: '',
    bannerData: '',
  });
  const [submittingEvent, setSubmittingEvent] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // LOST & FOUND STATE
  // --------------------------------------------------------------------------
  const [items, setItems] = useState<any[]>([]);
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('ALL');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [loadingItems, setLoadingItems] = useState<boolean>(true);
  const [showReportItemModal, setShowReportItemModal] = useState<boolean>(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    type: 'FOUND' as 'LOST' | 'FOUND',
    category: 'Electronics',
    location: '',
    imageData: '',
  });
  const [submittingItem, setSubmittingItem] = useState<boolean>(false);

  // Claims
  const [claimingItem, setClaimingItem] = useState<any | null>(null);
  const [claimProof, setClaimProof] = useState<string>('');
  const [claimContact, setClaimContact] = useState<string>('');
  const [submittingClaim, setSubmittingClaim] = useState<boolean>(false);

  // Inspect Claims (For Reporter / Admin)
  const [inspectingItem, setInspectingItem] = useState<any | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'EVENTS') {
      loadEvents();
    } else {
      loadItems();
    }
  }, [activeTab, eventCategoryFilter, itemTypeFilter]);

  const loadEvents = async (categoryOverride?: string) => {
    try {
      setLoadingEvents(true);
      const targetCategory = categoryOverride !== undefined ? categoryOverride : eventCategoryFilter;
      const res = await api.getCampusEvents({
        category: targetCategory !== 'ALL' ? targetCategory : undefined,
      });
      setEvents(res.events || []);
    } catch (err: any) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadItems = async (typeOverride?: string, searchOverride?: string) => {
    try {
      setLoadingItems(true);
      const targetType = typeOverride !== undefined ? typeOverride : itemTypeFilter;
      const targetSearch = searchOverride !== undefined ? searchOverride : itemSearch;
      const res = await api.getLostAndFoundItems({
        type: targetType !== 'ALL' ? targetType : undefined,
        search: targetSearch && targetSearch.trim() !== '' ? targetSearch.trim() : undefined,
      });
      setItems(res.items || []);
    } catch (err: any) {
      console.error('Failed to load lost and found items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  // Image Upload helper (converts to base64)
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (b64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --------------------------------------------------------------------------
  // EVENT ACTIONS
  // --------------------------------------------------------------------------
  const handleToggleUpvote = async (eventId: string) => {
    try {
      const res = await api.toggleEventUpvote(eventId);
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                hasUpvoted: res.hasUpvoted,
                upvotesCount: res.upvotesCount,
                trendingScore: ev.trendingScore + (res.hasUpvoted ? 2 : -2),
              }
            : ev
        )
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSetRsvp = async (eventId: string, newStatus: 'ATTENDING' | 'INTERESTED') => {
    const current = events.find((e) => e.id === eventId);
    const targetStatus = current?.userRsvp === newStatus ? 'REMOVE' : newStatus;

    try {
      const res = await api.setEventRsvp(eventId, targetStatus);
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                userRsvp: res.userRsvp,
                attendingCount: res.attendingCount,
                interestedCount: res.interestedCount,
              }
            : ev
        )
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingEvent(true);
      await api.createCampusEvent(newEvent);
      setShowCreateEventModal(false);
      setNewEvent({
        title: '',
        description: '',
        category: 'Technical',
        venue: '',
        eventDate: '',
        bannerData: '',
      });
      setNotification({ type: 'success', text: 'Campus event created successfully! It is now live on the trending board.' });
      setEventCategoryFilter('ALL');
      await loadEvents('ALL');
    } catch (err: any) {
      alert(err.data?.message || err.message);
    } finally {
      setSubmittingEvent(false);
    }
  };

  // --------------------------------------------------------------------------
  // LOST & FOUND ACTIONS
  // --------------------------------------------------------------------------
  const handleReportItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingItem(true);
      const res = await api.reportLostAndFoundItem(newItem);
      setShowReportItemModal(false);
      setNewItem({
        title: '',
        description: '',
        type: 'FOUND',
        category: 'Electronics',
        location: '',
        imageData: '',
      });
      setNotification({ type: 'success', text: 'Item reported successfully! The record is now live in the catalog.' });
      setItemTypeFilter('ALL');
      setItemSearch('');
      if (res?.item) {
        setItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)]);
      }
      await loadItems('ALL', '');
    } catch (err: any) {
      alert(err.data?.message || err.message);
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingItem) return;

    try {
      setSubmittingClaim(true);
      await api.claimItem(claimingItem.id, {
        proofDescription: claimProof,
        contactInfo: claimContact,
      });
      setClaimingItem(null);
      setClaimProof('');
      setClaimContact('');
      setNotification({
        type: 'success',
        text: 'Claim submitted! The reporter will review your proof of ownership.',
      });
      loadItems();
    } catch (err: any) {
      alert(err.data?.message || err.message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleReviewClaim = async (claimId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!inspectingItem) return;
    try {
      await api.reviewClaim(inspectingItem.id, claimId, {
        status,
        reviewNotes: status === 'APPROVED' ? 'Proof verified and matched.' : 'Insufficient evidence.',
      });
      setNotification({ type: 'success', text: `Claim ${status.toLowerCase()} successfully!` });
      setInspectingItem(null);
      loadItems();
    } catch (err: any) {
      alert(err.data?.message || err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Phase 2 • Shared Student & Faculty Community
          </span>
          <h1 className="text-3xl font-black tracking-tight mt-3">Apex Campus Hub</h1>
          <p className="text-amber-100 text-sm mt-2 leading-relaxed">
            Discover upcoming hackathons, tech bootcamps, and cultural festivals with real-time upvoting & RSVPs,
            plus our secure, verifiable campus Lost & Found registry.
          </p>

          {/* Tab Selector */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={() => setActiveTab('EVENTS')}
              className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'EVENTS'
                  ? 'bg-white text-orange-900 shadow-md'
                  : 'bg-black/20 text-white hover:bg-black/30'
              }`}
            >
              <Flame className="h-4 w-4 mr-2 text-amber-500" />
              Trending Events & Fests
            </button>

            <button
              onClick={() => setActiveTab('LOST_FOUND')}
              className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'LOST_FOUND'
                  ? 'bg-white text-orange-900 shadow-md'
                  : 'bg-black/20 text-white hover:bg-black/30'
              }`}
            >
              <Tag className="h-4 w-4 mr-2 text-amber-500" />
              Lost & Found Central
            </button>
          </div>
        </div>
      </div>

      {/* Global Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. TRENDING EVENTS TAB */}
      {/* ===================================================================== */}
      {activeTab === 'EVENTS' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {['ALL', 'Hackathon', 'Workshop', 'Technical', 'Cultural', 'Sports'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setEventCategoryFilter(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                    eventCategoryFilter === cat
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'All Events' : cat}
                </button>
              ))}
            </div>

            {currentUser?.role !== 'STUDENT' && (
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                <PlusCircle className="h-4 w-4 mr-1.5" />
                Host Campus Event
              </button>
            )}
          </div>

          {/* Events Grid */}
          {loadingEvents ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
              Loading trending campus events...
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
              No events found matching this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((ev, index) => (
                <div
                  key={ev.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    {/* Header Banner or Fallback Pattern */}
                    {ev.bannerUrl ? (
                      <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                        <img src={ev.bannerUrl} alt={ev.title} className="w-full h-full object-cover" />
                        <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                          {ev.category}
                        </span>
                        {index === 0 && (
                          <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center shadow">
                            <Flame className="h-3 w-3 mr-1 fill-white" />
                            #1 Trending
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-28 bg-gradient-to-r from-orange-500 to-amber-500 p-4 relative flex items-start justify-between">
                        <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                          {ev.category}
                        </span>
                        {index === 0 && (
                          <span className="bg-white text-orange-900 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center shadow">
                            <Flame className="h-3 w-3 mr-1 fill-orange-500 text-orange-500" />
                            #1 Trending
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-5 space-y-3">
                      <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-tight">
                        {ev.title}
                      </h3>

                      <div className="space-y-1.5 text-xs text-slate-500">
                        <div className="flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                          <span>{new Date(ev.eventDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-3.5 w-3.5 mr-2 text-slate-400" />
                          <span className="truncate">{ev.venue}</span>
                        </div>
                        <div className="flex items-center">
                          <User className="h-3.5 w-3.5 mr-2 text-slate-400" />
                          <span>Organized by: <strong className="text-slate-700">{ev.createdBy?.name}</strong></span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {ev.description}
                      </p>
                    </div>
                  </div>

                  {/* Upvote & RSVP Interactive Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Upvote Button */}
                    <button
                      onClick={() => handleToggleUpvote(ev.id)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        ev.hasUpvoted
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ThumbsUp className={`h-3.5 w-3.5 mr-1.5 ${ev.hasUpvoted ? 'fill-rose-600 text-rose-600' : ''}`} />
                      <span>{ev.upvotesCount}</span>
                    </button>

                    {/* RSVP Buttons */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleSetRsvp(ev.id, 'ATTENDING')}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center ${
                          ev.userRsvp === 'ATTENDING'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        <span>Attending ({ev.attendingCount})</span>
                      </button>

                      <button
                        onClick={() => handleSetRsvp(ev.id, 'INTERESTED')}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center ${
                          ev.userRsvp === 'INTERESTED'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        <span>Interested ({ev.interestedCount})</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. LOST & FOUND CENTRAL TAB */}
      {/* ===================================================================== */}
      {activeTab === 'LOST_FOUND' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Type Filter */}
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {['ALL', 'LOST', 'FOUND'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setItemTypeFilter(t)}
                    className={`text-xs px-3 py-1 rounded-md font-bold transition ${
                      itemTypeFilter === t
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t === 'ALL' ? 'All Items' : t}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64 flex items-center">
                <Search className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search item, location..."
                  value={itemSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItemSearch(val);
                    if (val === '') {
                      loadItems(itemTypeFilter, '');
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && loadItems(itemTypeFilter, itemSearch)}
                  className="w-full text-xs pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
                {itemSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemSearch('');
                      loadItems(itemTypeFilter, '');
                    }}
                    className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowReportItemModal(true)}
              className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Report Lost or Found Item
            </button>
          </div>

          {/* Items Grid */}
          {loadingItems ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
              Loading lost & found catalog...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
              No items reported matching current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => {
                const isReporter = item.reportedById === currentUser.id;
                const isAdmin = currentUser.role === 'ACADEMIC_ADMIN' || currentUser.role === 'EXAM_ADMIN';

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      {/* Image Preview or Icon */}
                      {item.imageUrl ? (
                        <div className="h-44 w-full bg-slate-100 overflow-hidden">
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-28 bg-slate-100 flex items-center justify-center text-slate-300">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                      )}

                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                              item.type === 'FOUND'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {item.type}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              item.status === 'RESOLVED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 line-clamp-1">{item.title}</h3>

                        <div className="space-y-1.5 text-xs text-slate-500">
                          <div className="flex items-center">
                            <Tag className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            <span>Category: <strong className="text-slate-700">{item.category}</strong></span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            <span className="truncate">{item.location}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            <span>Reported on {new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">
                        By {item.reportedBy?.name}
                      </span>

                      <div className="flex items-center space-x-2">
                        {/* Reporter or Admin inspect claims */}
                        {(isReporter || isAdmin) && item.claims?.length > 0 && (
                          <button
                            onClick={() => setInspectingItem(item)}
                            className="text-xs font-bold px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition"
                          >
                            Claims ({item.claims.length})
                          </button>
                        )}

                        {/* Other user submit claim */}
                        {!isReporter && item.status === 'OPEN' && (
                          <button
                            onClick={() => setClaimingItem(item)}
                            className="text-xs font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition"
                          >
                            Claim Item
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE EVENT */}
      {/* ===================================================================== */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">Host New Campus Event</h3>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & Cloud Hands-on Hackathon"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEvent.eventDate}
                    onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Venue / Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Auditorium / CSE Lab 3"
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Event Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details, eligibility, schedule..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Banner Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, (b64) => setNewEvent({ ...newEvent, bannerData: b64 }))}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
                {newEvent.bannerData && (
                  <div className="mt-2 relative w-32 h-20 rounded-lg overflow-hidden border border-slate-200">
                    <img src={newEvent.bannerData} alt="Banner Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, bannerData: '' })}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white rounded-full p-1 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {submittingEvent ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: REPORT LOST / FOUND ITEM */}
      {/* ===================================================================== */}
      {showReportItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">Report Lost or Found Item</h3>

            <form onSubmit={handleReportItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notice Type</label>
                  <select
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'LOST' | 'FOUND' })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold"
                  >
                    <option value="FOUND">FOUND (I discovered an item)</option>
                    <option value="LOST">LOST (I misplaced an item)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Item Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="IDs & Cards">IDs & Cards</option>
                    <option value="Books & Stationery">Books & Stationery</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Name / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Dell Laptop Charger / Student Lanyard"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Specific Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Seminar Hall B row 4 / Central Library 2nd floor"
                  value={newItem.location}
                  onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Description & Distinct Markings</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe color, scratches, stickers, condition..."
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, (b64) => setNewItem({ ...newItem, imageData: b64 }))}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                />
                {newItem.imageData && (
                  <div className="mt-2 relative w-32 h-24 rounded-lg overflow-hidden border border-slate-200">
                    <img src={newItem.imageData} alt="Item Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, imageData: '' })}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white rounded-full p-1 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReportItemModal(false)}
                  className="px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingItem}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {submittingItem ? 'Submitting...' : 'Post Item Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SUBMIT CLAIM */}
      {/* ===================================================================== */}
      {claimingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Claim This Item</h3>
            <p className="text-xs text-slate-500">
              Item: <span className="font-semibold text-slate-800">{claimingItem.title}</span>
            </p>

            <form onSubmit={handleSubmitClaim} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Proof of Ownership (Unique identifiers, serial no, serial pattern, wallpapers)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Has my initials PK engraved on back, lock screen wallpaper is a red car..."
                  value={claimProof}
                  onChange={(e) => setClaimProof(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Info (Phone / Email / College ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 9876543210, roll: 24CS001"
                  value={claimContact}
                  onChange={(e) => setClaimContact(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setClaimingItem(null)}
                  className="px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {submittingClaim ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: INSPECT CLAIMS (REPORTER / ADMIN) */}
      {/* ===================================================================== */}
      {inspectingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Review Claims for Item</h3>
                <p className="text-xs text-slate-500">{inspectingItem.title}</p>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {(inspectingItem.claims || []).map((c: any) => (
                <div key={c.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-900">{c.claimant?.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        c.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-slate-200 text-slate-700 space-y-1">
                    <div><strong>Proof Description:</strong> {c.proofDescription}</div>
                    <div><strong>Contact Info:</strong> {c.contactInfo}</div>
                  </div>

                  {c.status === 'PENDING' && (
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => handleReviewClaim(c.id, 'REJECTED')}
                        className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReviewClaim(c.id, 'APPROVED')}
                        className="px-3 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition"
                      >
                        Approve & Handover
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
