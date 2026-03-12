import { useEffect, useMemo, useState } from 'react';
import { BASE_CONCERTS, EMPTY_ENTRY, FESTIVALS } from './data';
import {
  loadCustomEntries,
  loadFestivalFavorites,
  loadOverrides,
  loadStubs,
  saveCustomEntries,
  saveFestivalFavorites,
  saveOverrides,
  saveStubs,
} from './storage';
import { applyFilters, favoriteLabel, formatDate, isUpcoming, normalizeArtist, parseArtists } from './utils';
import './styles.css';

const tabs = ['Concerts', 'Map', 'Stats', 'Add'];

function mergeData(base, overrides, custom) {
  const mergedBase = base.map((entry) => ({ ...entry, ...(overrides[entry.id] || {}), isCustom: false }));
  return [...mergedBase, ...custom.map((c) => ({ ...c, isCustom: true }))];
}

function App() {
  const [activeTab, setActiveTab] = useState('Concerts');
  const [filters, setFilters] = useState({
    search: '',
    year: 'all',
    type: 'all',
    favorite: 'all',
    order: 'oldest',
    showUpcoming: true,
  });
  const [overrides, setOverrides] = useState(() => loadOverrides());
  const [customEntries, setCustomEntries] = useState(() => loadCustomEntries());
  const [stubs, setStubs] = useState(() => loadStubs());
  const [festivalFavorites, setFestivalFavorites] = useState(() => loadFestivalFavorites());
  const [selectedShowId, setSelectedShowId] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [artistPanel, setArtistPanel] = useState('');
  const [venuePanel, setVenuePanel] = useState('');
  const [crewPanel, setCrewPanel] = useState('');
  const [expandedFestivals, setExpandedFestivals] = useState({});

  const entries = useMemo(() => mergeData(BASE_CONCERTS, overrides, customEntries), [overrides, customEntries]);
  const filteredEntries = useMemo(() => applyFilters(entries, filters), [entries, filters]);

  const selectedShow = entries.find((entry) => entry.id === selectedShowId);

  const years = useMemo(() => {
    const values = [...new Set(entries.map((entry) => new Date(entry.date).getFullYear().toString()))];
    return values.sort();
  }, [entries]);

  useEffect(() => saveOverrides(overrides), [overrides]);
  useEffect(() => saveCustomEntries(customEntries), [customEntries]);
  useEffect(() => saveStubs(stubs), [stubs]);
  useEffect(() => saveFestivalFavorites(festivalFavorites), [festivalFavorites]);

  function getShowNumber(entry) {
    const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.findIndex((item) => item.id === entry.id) + 1;
  }

  function setEntry(id, payload, isCustomEntry) {
    if (isCustomEntry) {
      setCustomEntries((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload } : item)));
      return;
    }
    setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...payload } }));
  }

  function removeCustomEntry(id) {
    setCustomEntries((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedShowId('');
  }

  function toggleFavorite(entry) {
    const next = entry.favorite === 'none' ? 'star' : entry.favorite === 'star' ? 'doublestar' : 'none';
    setEntry(entry.id, { favorite: next }, entry.isCustom);
  }

  function upsertEntry(form, existing) {
    const payload = {
      ...form,
      ticketPrice: Number(form.ticketPrice || 0),
      crew: form.crew,
      type: form.festKey ? 'festival' : form.type,
    };

    if (existing) {
      setEntry(existing.id, payload, existing.isCustom);
      setEditingEntry(null);
      return;
    }

    const newEntry = {
      ...payload,
      id: `custom-${Date.now()}`,
      isCustom: true,
    };
    setCustomEntries((prev) => [...prev, newEntry]);
    setEditingEntry(null);
    setActiveTab('Concerts');
  }

  function handleStubUpload(showId, file) {
    const reader = new FileReader();
    reader.onload = () => {
      setStubs((prev) => ({ ...prev, [showId]: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  const pastByYear = useMemo(() => {
    const list = filteredEntries.filter((entry) => !isUpcoming(entry));
    return list.reduce((acc, entry) => {
      const year = new Date(entry.date).getFullYear();
      acc[year] = [...(acc[year] || []), entry];
      return acc;
    }, {});
  }, [filteredEntries]);

  const upcoming = filteredEntries.filter((entry) => isUpcoming(entry));

  const stats = useMemo(() => {
    const totalShows = entries.length;
    const festivals = entries.filter((e) => e.festKey).length;
    const countryBreakdown = entries.reduce((acc, entry) => {
      const key = entry.country || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const artistCounts = {};
    const venueCounts = {};
    const crewCounts = {};
    const perYear = {};

    entries.forEach((entry) => {
      parseArtists(entry.artist).forEach((artist) => {
        const norm = normalizeArtist(artist);
        artistCounts[norm] = (artistCounts[norm] || 0) + 1;
      });
      venueCounts[entry.venue] = (venueCounts[entry.venue] || 0) + 1;
      (entry.crew || []).forEach((person) => {
        crewCounts[person] = (crewCounts[person] || 0) + 1;
      });
      const year = new Date(entry.date).getFullYear();
      perYear[year] = (perYear[year] || 0) + 1;
    });

    return {
      totalShows,
      festivalCount: festivals,
      countryCount: Object.keys(countryBreakdown).length,
      mostSeenArtists: Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
      showsPerYear: Object.entries(perYear).sort((a, b) => Number(a[0]) - Number(b[0])),
      countryBreakdown: Object.entries(countryBreakdown).sort((a, b) => b[1] - a[1]),
      topVenues: Object.entries(venueCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
      crewDirectory: Object.entries(crewCounts).sort((a, b) => b[1] - a[1]),
    };
  }, [entries]);

  const cityGroups = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const key = `${entry.city}, ${entry.country || 'Unknown'}`;
      acc[key] = [...(acc[key] || []), entry];
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([city, shows]) => ({ city, shows: shows.sort((a, b) => new Date(a.date) - new Date(b.date)) }))
      .sort((a, b) => b.shows.length - a.shows.length);
  }, [entries]);

  const allCrewSuggestions = useMemo(() => [...new Set(entries.flatMap((entry) => entry.crew || []))], [entries]);

  return (
    <div className="app">
      <header className="appHeader">Concert Chronicle</header>

      <main className="content">
        {activeTab === 'Concerts' && (
          <section>
            <Filters filters={filters} setFilters={setFilters} years={years} />

            {upcoming.length > 0 && (
              <div className="groupSection">
                <h2>Upcoming</h2>
                {upcoming.map((entry) => (
                  <ConcertRow
                    key={entry.id}
                    entry={entry}
                    showNumber={getShowNumber(entry)}
                    onOpen={() => setSelectedShowId(entry.id)}
                    onFavorite={() => toggleFavorite(entry)}
                    onArtistClick={setArtistPanel}
                    onVenueClick={setVenuePanel}
                    expandedFestivals={expandedFestivals}
                    setExpandedFestivals={setExpandedFestivals}
                    festivalFavorites={festivalFavorites}
                    setFestivalFavorites={setFestivalFavorites}
                  />
                ))}
              </div>
            )}

            {Object.entries(pastByYear)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([year, yearEntries]) => (
                <div className="groupSection" key={year}>
                  <h2>{year}</h2>
                  {yearEntries.map((entry) => (
                    <ConcertRow
                      key={entry.id}
                      entry={entry}
                      showNumber={getShowNumber(entry)}
                      onOpen={() => setSelectedShowId(entry.id)}
                      onFavorite={() => toggleFavorite(entry)}
                      onArtistClick={setArtistPanel}
                      onVenueClick={setVenuePanel}
                      expandedFestivals={expandedFestivals}
                      setExpandedFestivals={setExpandedFestivals}
                      festivalFavorites={festivalFavorites}
                      setFestivalFavorites={setFestivalFavorites}
                    />
                  ))}
                </div>
              ))}
          </section>
        )}

        {activeTab === 'Map' && (
          <section>
            <h2>Location Explorer</h2>
            <p className="muted">
              This frontend-only build uses a reliable location explorer instead of third-party map APIs.
            </p>
            <div className="cardList">
              {cityGroups.map((group) => (
                <article key={group.city} className="panelCard">
                  <h3>{group.city}</h3>
                  <p className="muted">{group.shows.length} show(s)</p>
                  <ul>
                    {group.shows.map((show) => (
                      <li key={show.id}>
                        <button
                          className="linkButton"
                          onClick={() => {
                            setActiveTab('Concerts');
                            setSelectedShowId(show.id);
                          }}
                        >
                          {formatDate(show.date)} — {show.artist} at {show.venue}
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'Stats' && (
          <section>
            <h2>Stats</h2>
            <div className="statsGrid">
              <StatCard label="Total Shows" value={stats.totalShows} />
              <StatCard label="Festival Count" value={stats.festivalCount} />
              <StatCard label="Country Count" value={stats.countryCount} />
            </div>

            <DataList title="Most Seen Artists" rows={stats.mostSeenArtists} onItemClick={setArtistPanel} />
            <DataList title="Shows per Year" rows={stats.showsPerYear} />
            <DataList title="Country Breakdown" rows={stats.countryBreakdown} />
            <DataList title="Top Venues" rows={stats.topVenues} onItemClick={setVenuePanel} />

            <section className="panelCard">
              <h3>Crew Directory</h3>
              <ul>
                {stats.crewDirectory.map(([person, count]) => (
                  <li key={person}>
                    <button className="linkButton" onClick={() => setCrewPanel(person)}>
                      {person}
                    </button>{' '}
                    <span className="muted">({count} show(s))</span>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}

        {activeTab === 'Add' && (
          <section>
            <h2>Add Concert</h2>
            <EntryForm
              initial={EMPTY_ENTRY}
              onSave={upsertEntry}
              onCancel={() => {}}
              crewSuggestions={allCrewSuggestions}
            />
          </section>
        )}
      </main>

      <nav className="tabNav">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={tab === activeTab ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {selectedShow && (
        <ShowModal
          show={selectedShow}
          onClose={() => setSelectedShowId('')}
          onEdit={() => setEditingEntry(selectedShow)}
          onDelete={() => removeCustomEntry(selectedShow.id)}
          onFavorite={() => toggleFavorite(selectedShow)}
          onArtistClick={setArtistPanel}
          onVenueClick={setVenuePanel}
          stub={stubs[selectedShow.id]}
          onStubUpload={handleStubUpload}
          onStubRemove={() => setStubs((prev) => {
            const copy = { ...prev };
            delete copy[selectedShow.id];
            return copy;
          })}
        />
      )}

      {editingEntry && (
        <ModalFrame title={`Edit: ${editingEntry.artist}`} onClose={() => setEditingEntry(null)}>
          <EntryForm
            initial={editingEntry}
            onSave={(payload) => upsertEntry(payload, editingEntry)}
            onCancel={() => setEditingEntry(null)}
            crewSuggestions={allCrewSuggestions}
          />
        </ModalFrame>
      )}

      {artistPanel && (
        <ArtistPanel artist={artistPanel} entries={entries} onClose={() => setArtistPanel('')} />
      )}

      {venuePanel && <VenuePanel venue={venuePanel} entries={entries} onClose={() => setVenuePanel('')} />}

      {crewPanel && <CrewPanel crew={crewPanel} entries={entries} onClose={() => setCrewPanel('')} />}
    </div>
  );
}

function Filters({ filters, setFilters, years }) {
  return (
    <section className="filterPanel">
      <input
        placeholder="Search artist, opener, venue, city, crew"
        value={filters.search}
        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
      />
      <select value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}>
        <option value="all">All years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}>
        <option value="all">All types</option>
        <option value="concert">Concerts</option>
        <option value="festival">Festivals</option>
      </select>
      <select
        value={filters.favorite}
        onChange={(e) => setFilters((prev) => ({ ...prev, favorite: e.target.value }))}
      >
        <option value="all">All favorites</option>
        <option value="star">Notable (★)</option>
        <option value="doublestar">All-time (★★)</option>
      </select>
      <div className="inlineButtons">
        <button onClick={() => setFilters((prev) => ({ ...prev, order: prev.order === 'oldest' ? 'newest' : 'oldest' }))}>
          {filters.order === 'oldest' ? 'Oldest → Newest' : 'Newest → Oldest'}
        </button>
        <button onClick={() => setFilters((prev) => ({ ...prev, showUpcoming: !prev.showUpcoming }))}>
          {filters.showUpcoming ? 'Hide Upcoming' : 'Show Upcoming'}
        </button>
        <button
          onClick={() =>
            setFilters({
              search: '',
              year: 'all',
              type: 'all',
              favorite: 'all',
              order: 'oldest',
              showUpcoming: true,
            })
          }
        >
          Clear Filters
        </button>
      </div>
    </section>
  );
}

function ConcertRow({
  entry,
  showNumber,
  onOpen,
  onFavorite,
  onArtistClick,
  onVenueClick,
  expandedFestivals,
  setExpandedFestivals,
  festivalFavorites,
  setFestivalFavorites,
}) {
  const festival = FESTIVALS[entry.festKey];

  function toggleFestivalArtistFavorite(festKey, artist) {
    const key = `${festKey}::${artist}`;
    setFestivalFavorites((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <article className="concertRow">
      <div className="rowTop" onClick={onOpen} role="button" tabIndex={0}>
        <span className="badge">#{showNumber}</span>
        <button className="linkButton" onClick={(e) => { e.stopPropagation(); onArtistClick(entry.artist); }}>
          {entry.artist}
        </button>
        <button className="favoriteButton" onClick={(e) => { e.stopPropagation(); onFavorite(); }}>
          {favoriteLabel(entry.favorite)}
        </button>
      </div>
      <p className="rowMeta">
        {entry.opener ? `w/ ${entry.opener} · ` : ''}
        <button className="linkButton" onClick={() => onVenueClick(entry.venue)}>
          {entry.venue}
        </button>{' '}
        · {entry.city} · {formatDate(entry.date)} {entry.pending ? '· Pending' : ''}
      </p>
      {festival && (
        <div className="festivalBox">
          <button
            onClick={() =>
              setExpandedFestivals((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
            }
          >
            {expandedFestivals[entry.id] ? 'Hide Festival Lineup' : 'Show Festival Lineup'}
          </button>
          {expandedFestivals[entry.id] && (
            <div className="festivalExpanded">
              <strong>{festival.name}</strong>
              {festival.days.map((day) => (
                <div key={day.label}>
                  <p>{day.label}</p>
                  <div className="chipWrap">
                    {day.artists.map((artist) => {
                      const key = `${entry.festKey}::${artist}`;
                      return (
                        <button key={artist} className="chip" onClick={() => onArtistClick(artist)}>
                          {artist}
                          <span
                            className="chipFav"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFestivalArtistFavorite(entry.festKey, artist);
                            }}
                          >
                            {festivalFavorites[key] ? ' ★' : ' ☆'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ShowModal({
  show,
  onClose,
  onEdit,
  onDelete,
  onFavorite,
  onArtistClick,
  onVenueClick,
  stub,
  onStubUpload,
  onStubRemove,
}) {
  return (
    <ModalFrame title={show.artist} onClose={onClose}>
      <div className="stack">
        <p>
          <strong>Date:</strong> {formatDate(show.date)}
        </p>
        <p>
          <strong>Venue:</strong>{' '}
          <button className="linkButton" onClick={() => onVenueClick(show.venue)}>
            {show.venue}
          </button>
        </p>
        <p>
          <strong>City:</strong> {show.city}, {show.country || 'Unknown'}
        </p>
        <p>
          <strong>Opener:</strong> {show.opener || 'N/A'}
        </p>
        <p>
          <strong>Crew:</strong> {(show.crew || []).join(', ') || 'Solo'}
        </p>
        <p>
          <strong>Notes:</strong> {show.notes || 'No notes'}
        </p>
        <div className="inlineButtons">
          <button onClick={onFavorite}>Favorite {favoriteLabel(show.favorite)}</button>
          <button onClick={() => onArtistClick(show.artist)}>Artist Detail</button>
          <button onClick={onEdit}>Edit</button>
          {show.isCustom && <button onClick={onDelete}>Delete Custom Entry</button>}
        </div>

        <section className="panelCard">
          <h4>Ticket Stub</h4>
          <p className="muted">Upload image stubs are stored in localStorage as data URLs.</p>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onStubUpload(show.id, e.target.files[0])} />
          {stub ? (
            <div>
              <img src={stub} alt="Ticket stub" className="stubImage" />
              <button onClick={onStubRemove}>Remove Stub</button>
            </div>
          ) : (
            <p className="muted">No stub on file (original may be lost).</p>
          )}
        </section>

        <section className="panelCard">
          <h4>Setlist</h4>
          {/* Live setlist API lookup is intentionally disabled in this frontend-only build.
              This should be replaced with a secure backend route in a future phase. */}
          <p className="muted">
            Live setlist lookup is disabled in this frontend-only build. A backend route is required for secure API access.
          </p>
        </section>
      </div>
    </ModalFrame>
  );
}

function EntryForm({ initial, onSave, onCancel, crewSuggestions }) {
  const [form, setForm] = useState(initial);
  const [crewInput, setCrewInput] = useState('');

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const matchingCrew = crewSuggestions.filter(
    (name) => name.toLowerCase().includes(crewInput.toLowerCase()) && !form.crew.includes(name),
  );

  function addCrew(name) {
    if (!name.trim() || form.crew.includes(name.trim())) return;
    setForm((prev) => ({ ...prev, crew: [...prev.crew, name.trim()] }));
    setCrewInput('');
  }

  return (
    <form
      className="entryForm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <label>
        Artist
        <input required value={form.artist} onChange={(e) => setForm((p) => ({ ...p, artist: e.target.value }))} />
      </label>
      <label>
        Opener
        <input value={form.opener} onChange={(e) => setForm((p) => ({ ...p, opener: e.target.value }))} />
      </label>
      <label>
        Venue
        <input required value={form.venue} onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))} />
      </label>
      <label>
        City
        <input required value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
      </label>
      <label>
        Country
        <input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
      </label>
      <label>
        Date
        <input type="date" required value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
      </label>
      <label>
        Set Time
        <input type="time" value={form.setTime} onChange={(e) => setForm((p) => ({ ...p, setTime: e.target.value }))} />
      </label>
      <label>
        Ticket Price
        <input type="number" min="0" value={form.ticketPrice} onChange={(e) => setForm((p) => ({ ...p, ticketPrice: e.target.value }))} />
      </label>
      <label>
        Fest Key
        <input value={form.festKey} onChange={(e) => setForm((p) => ({ ...p, festKey: e.target.value }))} />
      </label>
      <label>
        Favorite
        <select value={form.favorite} onChange={(e) => setForm((p) => ({ ...p, favorite: e.target.value }))}>
          <option value="none">None</option>
          <option value="star">Star</option>
          <option value="doublestar">Double Star</option>
        </select>
      </label>
      <label>
        Type
        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
          <option value="concert">Concert</option>
          <option value="festival">Festival</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={form.pending} onChange={(e) => setForm((p) => ({ ...p, pending: e.target.checked }))} />
        Pending
      </label>
      <label>
        <input
          type="checkbox"
          checked={form.estimated}
          onChange={(e) => setForm((p) => ({ ...p, estimated: e.target.checked }))}
        />
        Estimated
      </label>
      <label>
        Crew
        <input value={crewInput} onChange={(e) => setCrewInput(e.target.value)} placeholder="Type name and add" />
      </label>
      <div className="inlineButtons">
        <button type="button" onClick={() => addCrew(crewInput)}>
          Add Crew Member
        </button>
        {matchingCrew.slice(0, 5).map((name) => (
          <button key={name} type="button" onClick={() => addCrew(name)}>
            + {name}
          </button>
        ))}
      </div>
      <div className="chipWrap">
        {form.crew.map((name) => (
          <span className="chip" key={name}>
            {name}
            <button type="button" onClick={() => setForm((p) => ({ ...p, crew: p.crew.filter((n) => n !== name) }))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <label>
        Notes
        <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
      </label>
      <div className="inlineButtons">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ArtistPanel({ artist, entries, onClose }) {
  const normalized = normalizeArtist(artist.split(' / ')[0]);
  const appearances = entries
    .filter((entry) => parseArtists(entry.artist).map(normalizeArtist).includes(normalized))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const headlineCount = appearances.filter((entry) => normalizeArtist(parseArtists(entry.artist)[0]) === normalized).length;
  const festivalCount = appearances.filter((entry) => entry.festKey).length;
  const openerCount = entries.filter((entry) => (entry.opener || '').toLowerCase().includes(normalized.toLowerCase())).length;

  return (
    <ModalFrame title={`Artist: ${normalized}`} onClose={onClose}>
      <p>Appearances: {appearances.length}</p>
      <p>Headline count: {headlineCount}</p>
      <p>Festival count: {festivalCount}</p>
      <p>Opener/support count: {openerCount}</p>
      <h4>Chronological appearances</h4>
      <ul>
        {appearances.map((entry) => (
          <li key={entry.id}>
            {formatDate(entry.date)} — {entry.artist} at {entry.venue}
          </li>
        ))}
      </ul>
    </ModalFrame>
  );
}

function VenuePanel({ venue, entries, onClose }) {
  const shows = entries.filter((entry) => entry.venue === venue).sort((a, b) => new Date(a.date) - new Date(b.date));
  return (
    <ModalFrame title={`Venue: ${venue}`} onClose={onClose}>
      <ul>
        {shows.map((entry) => (
          <li key={entry.id}>
            {formatDate(entry.date)} — {entry.artist}
          </li>
        ))}
      </ul>
    </ModalFrame>
  );
}

function CrewPanel({ crew, entries, onClose }) {
  const shared = entries.filter((entry) => (entry.crew || []).includes(crew)).sort((a, b) => new Date(a.date) - new Date(b.date));
  return (
    <ModalFrame title={`Crew: ${crew}`} onClose={onClose}>
      <h4>Shared shows</h4>
      <ul>
        {shared.map((entry) => (
          <li key={entry.id}>
            {formatDate(entry.date)} — {entry.artist} ({entry.city})
          </li>
        ))}
      </ul>
    </ModalFrame>
  );
}

function ModalFrame({ title, onClose, children }) {
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modalHeader">
          <h3>{title}</h3>
          <button onClick={onClose}>Close</button>
        </header>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="panelCard">
      <p className="muted">{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function DataList({ title, rows, onItemClick }) {
  return (
    <section className="panelCard">
      <h3>{title}</h3>
      <ul>
        {rows.map(([name, value]) => (
          <li key={name}>
            {onItemClick ? (
              <button className="linkButton" onClick={() => onItemClick(name)}>
                {name}
              </button>
            ) : (
              <span>{name}</span>
            )}{' '}
            <span className="muted">({value})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default App;
