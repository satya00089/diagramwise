import React from "react";
import ReactDOM from "react-dom";
import Fuse from "fuse.js";
import type { CanvasComponent } from "../types/canvas";
import { GROUP_PRIORITY } from "../config/components";
import {
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCaretDownBold,
} from "react-icons/pi";
import { DEFAULT_PROVIDERS, type ProviderOption } from "./ProviderSelector";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchMinimalComponents,
  setSelectedProviders,
  toggleProvider,
  type MinimalComponent,
} from "../store/slices/componentsSlice";
import { loadSpriteManifest } from "../store/slices/spritesSlice";
import { shouldUseDirectIcon } from "../utils/iconRendering";
import SpriteIcon from "./SpriteIcon";

interface Props {
  readonly components: readonly CanvasComponent[];
  readonly onAdd: (id: string) => void;
  readonly enableProviderFilter?: boolean;
  readonly customProviders?: ProviderOption[];
  readonly compact?: boolean;
  readonly compactOpen?: boolean;
  readonly onCompactOpenChange?: (open: boolean) => void;
}

export default function ComponentPalette({
  components: defaultComponents,
  onAdd,
  enableProviderFilter = false,
  customProviders,
  compact = false,
  compactOpen = false,
  onCompactOpenChange,
}: Props) {
  const dispatch = useAppDispatch();

  // Redux state
  const { minimalComponents, selectedProviders, loading, error } =
    useAppSelector((state) => state.components);
  const spriteIcons = useAppSelector((state) => state.sprites.allIcons);
  const spriteProviderStatus = useAppSelector(
    (state) => state.sprites.providerStatus,
  );

  const [desktopOpen, setOpen] = React.useState(true);
  const open = compact ? compactOpen : desktopOpen;
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  );
  const [expandedProviders, setExpandedProviders] = React.useState<Set<string>>(
    new Set(["Custom"]), // Start with Custom expanded
  );
  const prevSelectedProvidersRef = React.useRef<string[]>([]);
  const [hoveredComponent, setHoveredComponent] = React.useState<{
    label: string;
    description: string;
    rect: DOMRect;
  } | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showProviderDropdown, setShowProviderDropdown] = React.useState(false);
  const [filteredProviders, setFilteredProviders] = React.useState<
    ProviderOption[]
  >([]);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Use custom providers or default ones
  const providers = React.useMemo(
    // Keep the core cloud providers available without requiring a caller to
    // opt into a custom list. Kubernetes uses the same provider catalog and
    // sprite contract as AWS, Azure, and GCP.
    () => customProviders || DEFAULT_PROVIDERS.slice(0, 5),
    [customProviders],
  );

  // Fetch components when providers change
  React.useEffect(() => {
    // Collapse all category groups when providers change
    setExpandedGroups(new Set());

    // Always fetch when specific providers are selected (not just 'all')
    if (selectedProviders.includes("all")) {
      // When 'all' is selected, expand Custom by default
      setExpandedProviders(new Set(["Custom"]));
      prevSelectedProvidersRef.current = [];
    } else {
      dispatch(fetchMinimalComponents(selectedProviders));
      // Pre-load sprite manifests for selected providers
      for (const p of selectedProviders) {
        dispatch(loadSpriteManifest(p));
      }

      // Only expand newly added providers, preserve existing state
      const prevProviders = prevSelectedProvidersRef.current;
      const newProviders = selectedProviders.filter(
        (p) => !prevProviders.includes(p),
      );

      setExpandedProviders((prev) => {
        const next = new Set(prev);

        // Expand newly added providers
        for (const p of newProviders) {
          next.add(p);
        }

        // Remove providers that are no longer selected
        for (const p of Array.from(next)) {
          if (!selectedProviders.includes(p) && p !== "Custom") {
            next.delete(p);
          }
        }

        return next;
      });

      // Update ref for next comparison
      prevSelectedProvidersRef.current = [...selectedProviders];
    }
  }, [dispatch, selectedProviders]);

  // Filter providers based on search query
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setShowProviderDropdown(false);
      setFilteredProviders([]);
      return;
    }

    const query = searchQuery.toLowerCase();

    // Check if query matches any provider
    const matches = providers.filter(
      (p) =>
        p.id.toLowerCase() !== "all" &&
        (p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)),
    );

    if (matches.length > 0) {
      setFilteredProviders(matches);
      setShowProviderDropdown(true);
    } else {
      setFilteredProviders([]);
      setShowProviderDropdown(false);
    }
  }, [searchQuery, providers, enableProviderFilter]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowProviderDropdown(false);
      }
    };

    if (showProviderDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showProviderDropdown]);

  // Merge default components with provider components
  const components: (CanvasComponent | MinimalComponent)[] =
    React.useMemo(() => {
      // Always include default components (like Custom)
      const baseComponents = Array.from(defaultComponents);

      // If specific providers are selected, add their components
      if (!selectedProviders.includes("all")) {
        return loading
          ? baseComponents
          : [...baseComponents, ...minimalComponents];
      }

      // If 'all' is selected or no provider filter, show default components
      if (!enableProviderFilter) {
        return baseComponents;
      }

      // If loading, show default components
      if (loading) {
        return baseComponents;
      }

      // 'all' selected with provider filter enabled - show only default components
      return baseComponents;
    }, [
      selectedProviders,
      loading,
      minimalComponents,
      enableProviderFilter,
      defaultComponents,
    ]);

  // Fuse.js instance for fuzzy search
  const fuse = React.useMemo(() => {
    return new Fuse(Array.from(components), {
      keys: [
        { name: "label", weight: 0.4 },
        { name: "tags", weight: 0.25 },
        { name: "description", weight: 0.2 },
        { name: "group", weight: 0.15 },
      ],
      threshold: 0.3,
      includeScore: true,
    });
  }, [components]);

  // Filter components based on search
  const filteredComponents = React.useMemo(() => {
    const query = searchQuery.trim();

    // If no query or provider dropdown is showing, return all components
    if (!query || showProviderDropdown) {
      return Array.from(components);
    }

    const results = fuse.search(query);
    const searchResults = results.map((result) => result.item);

    // Always include Custom Component in search results
    const customComponent = components.find((c) => c.id === "custom-component");
    const hasCustomComponent = searchResults.some(
      (c) => c.id === "custom-component",
    );

    if (customComponent && !hasCustomComponent) {
      // Add Custom Component at the end of search results
      searchResults.push(customComponent);
    }

    return searchResults;
  }, [components, fuse, searchQuery, showProviderDropdown]);

  // Group components by provider first, then by category
  const groupedByProvider = React.useMemo(() => {
    // First group by provider
    const providerMap = new Map<
      string,
      (CanvasComponent | MinimalComponent)[]
    >();

    for (const c of filteredComponents) {
      const provider = ("platform" in c ? c.platform : "Custom") || "Other";
      if (!providerMap.has(provider)) providerMap.set(provider, []);
      providerMap.get(provider)!.push(c);
    }

    // Then group each provider's components by category
    const result = new Map<
      string,
      Map<string, (CanvasComponent | MinimalComponent)[]>
    >();

    for (const [provider, components] of providerMap.entries()) {
      const categoryMap = new Map<
        string,
        (CanvasComponent | MinimalComponent)[]
      >();

      for (const c of components) {
        const category = c.group ?? "Other";
        if (!categoryMap.has(category)) categoryMap.set(category, []);
        categoryMap.get(category)!.push(c);
      }

      // Sort categories by priority
      const sortedCategories = new Map(
        Array.from(categoryMap.entries()).sort((a, b) => {
          const priorityA = GROUP_PRIORITY[a[0]] ?? 999;
          const priorityB = GROUP_PRIORITY[b[0]] ?? 999;
          return priorityA - priorityB;
        }),
      );

      result.set(provider, sortedCategories);
    }

    return result;
  }, [filteredComponents]);

  // Groups start collapsed by default (handled by useState initialization)
  // User can expand groups they want to see

  const toggleProviderExpansion = (provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Lazy load full component data when dragged
  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    setHoveredComponent(null);

    // Use the button itself as drag image since it already has the loaded icon
    const targetButton = e.currentTarget as HTMLElement;
    if (e.dataTransfer) {
      e.dataTransfer.setDragImage(
        targetButton,
        targetButton.offsetWidth / 2,
        targetButton.offsetHeight / 2,
      );
      e.dataTransfer.effectAllowed = "move";
    }

    // Pass only component ID - full data will be fetched from Redux on drop
    e.dataTransfer?.setData(
      "application/reactflow",
      JSON.stringify({ type: componentId }),
    );
    e.dataTransfer?.setData("text/plain", componentId);
  };

  const handleProviderSelect = (provider: ProviderOption) => {
    dispatch(toggleProvider(provider.id));
    // Clear search query and close dropdown
    setSearchQuery("");
    setShowProviderDropdown(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="relative z-40 max-md:absolute max-md:inset-y-0 max-md:left-0" data-tour="component-palette">
      <button
        type="button"
        onClick={() => compact ? onCompactOpenChange?.(!open) : setOpen(!open)}
        aria-expanded={open}
        aria-label={
          open ? "Collapse component palette" : "Expand component palette"
        }
        aria-controls="component-palette-panel"
        className={`absolute top-5 -right-3 h-6 w-6 max-md:h-11 max-md:w-11 flex items-center justify-center rounded-full border border-theme bg-surface text-theme shadow cursor-pointer hover:bg-[var(--bg-hover)] transition-colors z-50 ${open ? "max-md:-right-11" : "max-md:right-auto max-md:left-0"}`}
      >
        {open ? <PiCaretLeftBold size={16} /> : <PiCaretRightBold size={16} />}
      </button>
      <div
        className={`relative shrink-0 group h-full flex flex-col bg-surface border-r border-theme overflow-y-auto overflow-x-hidden component-palette transition-[width] duration-300 ease-in-out z-40 ${
          open ? "w-56 p-3 pr-0" : "w-6 p-1"
        }`}
        aria-label="Component palette"
        id="component-palette-panel"
      >
        {open ? (
          <>
            {/* Current Provider Badges */}
            {!selectedProviders.includes("all") &&
              selectedProviders.length > 0 && (
                <div className="mr-3 mb-2 flex flex-wrap gap-1.5">
                  {selectedProviders.map((providerId) => {
                    const provider = providers.find((p) => p.id === providerId);
                    if (!provider) return null;
                    const Icon = provider.icon;
                    return (
                      <div
                        key={providerId}
                        className="flex items-center gap-1.5 px-2 py-1 bg-[var(--brand)]/10 border border-[var(--brand)]/20 rounded text-xs"
                      >
                        {Icon && (
                          <Icon size={16} style={{ color: provider.color }} />
                        )}
                        <span className="text-theme font-small">
                          {provider.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => dispatch(toggleProvider(providerId))}
                          className="text-muted hover:text-theme"
                          aria-label={`Remove ${provider.name} filter`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  {selectedProviders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => dispatch(setSelectedProviders(["all"]))}
                      className="px-2 py-1 text-xs text-muted hover:text-theme underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-4 text-muted text-sm flex items-center justify-center gap-2 mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--brand)] border-t-transparent"></div>
                <span>Loading components...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mx-3 mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500">
                {error}
              </div>
            )}

            {/* Unified Search Input with Provider Dropdown */}
            <div className="mr-3 mb-3 relative">
              <input
                ref={searchInputRef}
                data-tour="palette-search"
                type="text"
                placeholder="Search providers or components..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-3 py-1.5 text-sm border border-theme rounded bg-[var(--bg)] text-theme placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />

              {/* Provider Dropdown */}
              {showProviderDropdown && filteredProviders.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-1 w-full bg-[var(--surface)] border border-theme rounded shadow-lg max-h-48 overflow-y-auto"
                >
                  <div className="px-2 py-1.5 text-xs text-muted border-b border-theme">
                    Click to toggle providers
                  </div>
                  {filteredProviders.map((provider) => {
                    const Icon = provider.icon;
                    const isSelected = selectedProviders.includes(provider.id);
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleProviderSelect(provider)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-theme hover:bg-[var(--bg-hover)] transition-colors ${
                          isSelected ? "bg-[var(--brand)]/10" : ""
                        }`}
                      >
                        {Icon && (
                          <Icon size={16} style={{ color: provider.color }} />
                        )}
                        <span className="font-small">{provider.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1 flex-1 overflow-y-auto component-palette">
              {groupedByProvider.size === 0 ? (
                <div className="text-center py-8 text-muted text-sm">
                  No components found
                </div>
              ) : (
                Array.from(groupedByProvider.entries()).map(
                  ([providerName, categories]) => {
                    const isProviderExpanded =
                      expandedProviders.has(providerName);
                    const totalComponents = Array.from(
                      categories.values(),
                    ).reduce((sum, list) => sum + list.length, 0);

                    // If only Custom provider and 'all' is selected, skip provider header
                    const showProviderHeader = !(
                      selectedProviders.includes("all") &&
                      providerName === "Custom" &&
                      groupedByProvider.size === 1
                    );

                    return (
                      <div key={providerName} className="mb-2">
                        {/* Provider Level */}
                        {showProviderHeader && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleProviderExpansion(providerName)
                            }
                            className="w-full flex items-center justify-between px-2 py-2 text-left hover:bg-[var(--bg-hover)] rounded transition-colors bg-[var(--brand)]/5 border border-[var(--brand)]/10"
                            aria-expanded={isProviderExpanded}
                          >
                            <div className="flex items-center gap-2">
                              <PiCaretDownBold
                                size={12}
                                className={`text-theme transition-transform duration-150 ${
                                  isProviderExpanded ? "rotate-0" : "-rotate-90"
                                }`}
                              />
                              <span className="text-sm font-semibold text-theme">
                                {providerName}
                              </span>
                              <span className="text-xs text-muted">
                                ({totalComponents})
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Categories within Provider */}
                        {(isProviderExpanded || !showProviderHeader) && (
                          <div
                            className={
                              showProviderHeader
                                ? "mt-1 space-y-1"
                                : "space-y-1"
                            }
                          >
                            {Array.from(categories.entries()).map(
                              ([groupName, list]) => {
                                const isExpanded = expandedGroups.has(
                                  `${providerName}-${groupName}`,
                                );
                                return (
                                  <div key={groupName}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleGroup(
                                          `${providerName}-${groupName}`,
                                        )
                                      }
                                      className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-[var(--bg-hover)] rounded transition-colors"
                                      aria-expanded={isExpanded}
                                      aria-controls={`group-${providerName}-${groupName}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <PiCaretDownBold
                                          size={10}
                                          className={`text-muted transition-transform duration-150 ${
                                            isExpanded
                                              ? "rotate-0"
                                              : "-rotate-90"
                                          }`}
                                        />
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted">
                                          {groupName}
                                        </span>
                                        <span className="text-[10px] text-muted">
                                          ({list.length})
                                        </span>
                                      </div>
                                    </button>
                                    {isExpanded && (
                                      <div
                                        id={`group-${groupName}`}
                                        className="mt-1 mb-3 px-1"
                                      >
                                        <div className="grid grid-cols-2 gap-1.5">
                                          {list.map((c) => (
                                            <button
                                              key={c.id}
                                              type="button"
                                              draggable
                                              aria-label={`Add ${c.label} to canvas`}
                                              onMouseEnter={(e) => {
                                                const rect =
                                                  e.currentTarget.getBoundingClientRect();
                                                setHoveredComponent({
                                                  label: c.label,
                                                  description:
                                                    c.description || "",
                                                  rect,
                                                });
                                              }}
                                              onMouseLeave={() =>
                                                setHoveredComponent(null)
                                              }
                                              onDragStart={(e) =>
                                                handleDragStart(e, c.id)
                                              }
                                              onKeyDown={(e) => {
                                                if (
                                                  (e as React.KeyboardEvent)
                                                    .key === "Enter" ||
                                                  (e as React.KeyboardEvent)
                                                    .key === " "
                                                ) {
                                                  (
                                                    e as React.KeyboardEvent
                                                  ).preventDefault();
                                                  onAdd(c.id);
                                                }
                                              }}
                                              className="text-left p-2 border border-theme rounded-md cursor-grab select-none hover:border-[var(--brand)] hover:bg-[var(--bg-hover)] transition-all group/item"
                                            >
                                              <div className="flex justify-center items-center">
                                                {"iconUrl" in c && c.iconUrl ? (
                                                  <div className="w-10 h-10 mb-1 relative flex items-center justify-center">
                                                    {(() => {
                                                      if (
                                                        shouldUseDirectIcon(
                                                          c.id,
                                                        )
                                                      ) {
                                                        return (
                                                          <img
                                                            src={c.iconUrl}
                                                            alt={c.label}
                                                            className="w-10 h-10 object-contain"
                                                          />
                                                        );
                                                      }
                                                      if (spriteIcons[c.id]) {
                                                        return (
                                                          <SpriteIcon
                                                            sprite={
                                                              spriteIcons[c.id]
                                                            }
                                                            displaySize={40}
                                                            alt={c.label}
                                                            style={{
                                                              opacity: 0.9,
                                                            }}
                                                          />
                                                        );
                                                      }
                                                      const pfx =
                                                        c.id.split("-")[0];
                                                      const isKnownProvider = [
                                                        "aws",
                                                        "azure",
                                                        "gcp",
                                                        "kubernetes",
                                                      ].includes(pfx);
                                                      const st =
                                                        spriteProviderStatus[
                                                          pfx
                                                        ];
                                                      // For known providers: never fire individual iconUrl requests.
                                                      // Only fall back on error, or if not a sprite provider.
                                                      if (
                                                        isKnownProvider &&
                                                        st !== "error"
                                                      )
                                                        return null;
                                                      return (
                                                        <img
                                                          src={c.iconUrl}
                                                          alt={c.label}
                                                          className="w-10 h-10 object-contain"
                                                        />
                                                      );
                                                    })()}
                                                  </div>
                                                ) : (
                                                  <div className="w-10 h-10 mb-1 relative">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)]/15 to-[var(--brand)]/5 rounded-full"></div>
                                                    <div className="z-10 opacity-75 w-full h-full flex items-center justify-center">
                                                      <span className="inline-flex items-center justify-center w-full h-full">
                                                        {"icon" in c &&
                                                        c.icon ? (
                                                          React.createElement(
                                                            c.icon as React.ComponentType<{
                                                              size?: number;
                                                            }>,
                                                            { size: 24 },
                                                          )
                                                        ) : (
                                                          <span className="text-lg">
                                                            ?
                                                          </span>
                                                        )}
                                                      </span>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="text-xs font-medium text-theme text-center group-hover/item:text-[var(--brand)] transition-colors line-clamp-1">
                                                {c.label}
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>
                    );
                  },
                )
              )}

              <div className="mt-4 px-2 py-2.5 rounded text-xs bg-[var(--bg-hover)]">
                <div className="font-medium mb-1 text-theme">💡 Tip</div>
                <div className="text-muted">
                  Drag a component to the canvas to start designing
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <span className="sr-only">Component palette collapsed</span>
          </div>
        )}
      </div>

      {/* Portal Tooltip - renders at body level to avoid clipping */}
      {hoveredComponent &&
        ReactDOM.createPortal(
          <div
            className="app-tooltip pointer-events-none z-[100000] -translate-y-1/2"
            style={
              {
                left: `${hoveredComponent.rect.right + 8}px`,
                top: `${hoveredComponent.rect.top + hoveredComponent.rect.height / 2}px`,
              } as React.CSSProperties
            }
          >
            <div className="font-semibold">
              {hoveredComponent.label}
            </div>
            <div className="mt-0.5 opacity-80">
              {hoveredComponent.description}
            </div>
            <span
              className="app-tooltip__arrow app-tooltip__arrow--left"
              aria-hidden="true"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
