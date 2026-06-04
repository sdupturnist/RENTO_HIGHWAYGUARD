"use client";
import * as React from "react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/app/lib/utils";

// Create context to propagate the search query to options
const SelectSearchContext = React.createContext({
    searchQuery: "",
    setSearchQuery: () => {},
    isSearchable: false,
});

// Recursively get text content from child React nodes
function getTextFromChildren(children) {
    let text = "";
    React.Children.forEach(children, (child) => {
        if (typeof child === "string" || typeof child === "number") {
            text += child;
        } else if (child && typeof child === "object") {
            if (child.props && child.props.children) {
                text += getTextFromChildren(child.props.children);
            } else if (Array.isArray(child)) {
                text += getTextFromChildren(child);
            }
        }
    });
    return text;
}

// Count total SelectItem components (identified by presence of "value" prop to be HMR-resilient)
function countSelectItems(children) {
    let count = 0;
    React.Children.forEach(children, (child) => {
        if (!child) return;
        if (child.props && child.props.value !== undefined) {
            count++;
        } else if (child.type === React.Fragment) {
            count += countSelectItems(child.props.children);
        } else if (child.props && child.props.children) {
            count += countSelectItems(child.props.children);
        }
    });
    return count;
}

// Count SelectItem components that match the query (identified by presence of "value" prop to be HMR-resilient)
function countMatchingItems(children, query) {
    let count = 0;
    if (!query) {
        return countSelectItems(children);
    }
    
    React.Children.forEach(children, (child) => {
        if (!child) return;
        if (child.props && child.props.value !== undefined) {
            const text = getTextFromChildren(child.props.children).toLowerCase();
            if (text.includes(query.toLowerCase())) {
                count++;
            }
        } else if (child.type === React.Fragment) {
            count += countMatchingItems(child.props.children, query);
        } else if (child.props && child.props.children) {
            count += countMatchingItems(child.props.children, query);
        }
    });
    return count;
}

function Select({ ...props }) {
    return <SelectPrimitive.Root data-slot="select" {...props}/>;
}

function SelectGroup({ children, ...props }) {
    const { searchQuery, isSearchable } = React.useContext(SelectSearchContext);
    
    const hasMatchingItems = React.useMemo(() => {
        if (!isSearchable || !searchQuery) return true;
        return countMatchingItems(children, searchQuery) > 0;
    }, [children, searchQuery, isSearchable]);

    if (!hasMatchingItems) {
        return null;
    }

    return <SelectPrimitive.Group data-slot="select-group" {...props}>{children}</SelectPrimitive.Group>;
}

function SelectValue({ ...props }) {
    return <SelectPrimitive.Value data-slot="select-value" {...props}/>;
}

function SelectTrigger({ className, size = "default", children, ...props }) {
    return (<SelectPrimitive.Trigger data-slot="select-trigger" data-size={size} className={cn("border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50"/>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>);
}

function SelectContent({ className, children, position = "item-aligned", align = "center", searchable, ...props }) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const inputRef = React.useRef(null);
    
    const itemsCount = React.useMemo(() => {
        return countSelectItems(children);
    }, [children]);
    
    const showSearch = searchable !== undefined ? searchable : itemsCount > 2;
    
    const matchingCount = React.useMemo(() => {
        return countMatchingItems(children, searchQuery);
    }, [children, searchQuery]);

    React.useEffect(() => {
        if (showSearch && inputRef.current) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [showSearch]);

    return (
      <SelectSearchContext.Provider value={{ searchQuery, setSearchQuery, isSearchable: showSearch }}>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content data-slot="select-content" className={cn("bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-hidden rounded-md border shadow-md flex flex-col", position === "popper" &&
                "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", className)} position={position} align={align} {...props}>
            <SelectScrollUpButton />
            
            {showSearch && (
              <div className="p-2 border-b bg-popover sticky top-0 z-10 shrink-0">
                <div className="relative flex items-center">
                  <SearchIcon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent pl-8 pr-2 py-1.5 text-xs rounded-md border focus:outline-hidden focus:ring-1 focus:ring-ring border-input placeholder:text-muted-foreground/60 text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") return;
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            <SelectPrimitive.Viewport className={cn("p-1 overflow-y-auto grow", position === "popper" &&
                "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1")}>
              {children}
              
              {showSearch && searchQuery && matchingCount === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground/80">
                  No results found.
                </div>
              )}
            </SelectPrimitive.Viewport>
            <SelectScrollDownButton />
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectSearchContext.Provider>
    );
}

function SelectLabel({ className, ...props }) {
    return (<SelectPrimitive.Label data-slot="select-label" className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)} {...props}/>);
}

function SelectItem({ className, children, ...props }) {
    const { searchQuery, isSearchable } = React.useContext(SelectSearchContext);
    
    const textContent = React.useMemo(() => {
        return getTextFromChildren(children).toLowerCase();
    }, [children]);
    
    if (isSearchable && searchQuery && !textContent.includes(searchQuery.toLowerCase())) {
        return null;
    }
    
    return (<SelectPrimitive.Item data-slot="select-item" className={cn("focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2", className)} {...props}>
      <span data-slot="select-item-indicator" className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4"/>
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>);
}

function SelectSeparator({ className, ...props }) {
    return (<SelectPrimitive.Separator data-slot="select-separator" className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)} {...props}/>);
}

function SelectScrollUpButton({ className, ...props }) {
    return (<SelectPrimitive.ScrollUpButton data-slot="select-scroll-up-button" className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronUpIcon className="size-4"/>
    </SelectPrimitive.ScrollUpButton>);
}

function SelectScrollDownButton({ className, ...props }) {
    return (<SelectPrimitive.ScrollDownButton data-slot="select-scroll-down-button" className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronDownIcon className="size-4"/>
    </SelectPrimitive.ScrollDownButton>);
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue, };
