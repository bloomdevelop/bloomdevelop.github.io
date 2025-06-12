import { useState, useEffect, Fragment } from 'react';
import type { CollectionEntry } from 'astro:content';
import { Combobox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import "./styles/index.css";

type Post = CollectionEntry<'posts'>;
type GroupedPosts = {
  year: number;
  month: string;
  posts: Post[];
}[];

interface PostFiltersProps {
  allPosts: GroupedPosts;
  initialPosts: GroupedPosts;
}

export default function PostFilters({ allPosts, initialPosts }: PostFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [availableTags, setAvailableTags] = useState<Set<string>>(new Set());
  const [filteredPosts, setFilteredPosts] = useState<GroupedPosts>(initialPosts);

  // Extract all unique tags from posts
  useEffect(() => {
    const tags = new Set<string>();
    allPosts.forEach(group => {
      group.posts.forEach(post => {
        post.data.tags?.forEach(tag => tags.add(tag));
      });
    });
    setAvailableTags(tags);
  }, [allPosts]);

  // Filter posts based on search query and selected tags
  useEffect(() => {
    const filtered = allPosts.map(group => ({
      ...group,
      posts: group.posts.filter(post => {
        // Filter by search query (title and content)
        const matchesSearch =
          post.data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.body?.toLowerCase().includes(searchQuery.toLowerCase());

        // Filter by tags
        const matchesTags = selectedTags.size === 0 ||
          (post.data.tags && Array.from(selectedTags).every(tag =>
            post.data.tags?.includes(tag)
          ));

        return matchesSearch && matchesTags;
      })
    })).filter(group => group.posts.length > 0);

    setFilteredPosts(filtered);
  }, [searchQuery, selectedTags, allPosts]);

  // Filter tags based on search query
  const [tagQuery, setTagQuery] = useState('');
  const filteredTags = Array.from(availableTags).filter((tag) =>
    tag.toLowerCase().includes(tagQuery.toLowerCase())
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const newTags = new Set(prev);
      if (newTags.has(tag)) {
        newTags.delete(tag);
      } else {
        newTags.add(tag);
      }
      return newTags;
    });
  };

  return (
    <div className="filters-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search posts"
        />
        <div className="combobox-container">
          <Combobox value={Array.from(selectedTags)} multiple>
            <div className="relative">
              <div className="combobox-input-container">
                <div className="selected-tags-input">
                  {Array.from(selectedTags).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                      <button
                        type="button"
                        className="remove-tag"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTag(tag);
                        }}
                        aria-label={`Remove ${tag} tag`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <Combobox.Input
                    className="combobox-input"
                    placeholder={selectedTags.size === 0 ? 'Filter by tags...' : ''}
                    onChange={(event) => setTagQuery(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && tagQuery === '' && selectedTags.size > 0) {
                        // Remove the last tag on backspace when input is empty
                        const lastTag = Array.from(selectedTags).pop();
                        if (lastTag) toggleTag(lastTag);
                      }
                    }}
                  />
                </div>
                <Combobox.Button className="combobox-button">
                  <ChevronUpDownIcon
                    className="combobox-icon"
                    aria-hidden="true"
                  />
                </Combobox.Button>
              </div>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                afterLeave={() => setTagQuery('')}
              >
                <Combobox.Options className="combobox-options">
                  {filteredTags.length === 0 && tagQuery !== '' ? (
                    <div className="no-results">
                      No tags found
                    </div>
                  ) : (
                    filteredTags.map((tag) => (
                      <Combobox.Option
                        key={tag}
                        className={({ active }) =>
                          `option ${active ? 'active' : ''} ${selectedTags.has(tag) ? 'selected' : ''}`
                        }
                        value={tag}
                        onClick={() => toggleTag(tag)}
                      >
                        {({ selected }) => (
                          <>
                            <span className={`tag-label ${selected ? 'font-medium' : ''}`}>
                              {tag}
                            </span>
                            {selected && (
                              <CheckIcon className="check-icon" aria-hidden="true" />
                            )}
                          </>
                        )}
                      </Combobox.Option>
                    ))
                  )}
                </Combobox.Options>
              </Transition>
            </div>
            {/* Selected tags are now displayed inside the input */}
          </Combobox>
        </div>
      </div>

      <div id="filtered-posts">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((group) => (
            <section key={`${group.year}-${group.month}`} className="post-group">
              <h2>
                {group.month} {group.year}
              </h2>
              <div className="posts-list">
                {group.posts.map((post) => (
                  <a key={post.id} href={`/posts/${post.id}`} className="post-card">
                    <h3>{post.data.title}</h3>
                    <div className="post-meta">
                      <span className="post-date">
                        {new Date(post.data.pubDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                      {post.data.tags && (
                        <div className="post-tags">
                          {post.data.tags.map(tag => (
                            <span key={tag} className="post-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="no-results">No posts match your search criteria.</p>
        )}
      </div>
    </div>
  );
}
