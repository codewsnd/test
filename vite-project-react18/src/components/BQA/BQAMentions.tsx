import React, { useState, useCallback, useMemo, useRef } from "react";
import { Mentions, Avatar } from 'antd';
import { connect, mapProps } from '@formily/react';

// Types
export interface MentionUser {
  name: string;
  avatar: string;
}

interface MentionsWithDefaultsProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: (e: any) => void;
  onFocus?: (e: any) => void;
  style?: React.CSSProperties;
  [key: string]: any;
}

const MENTION_SPAN_STYLES = {
  color: '#1890ff',
  fontWeight: 'bold',
  backgroundColor: 'rgba(24, 144, 255, 0.1)',
  padding: '1px 3px',
  borderRadius: '3px',
  cursor: 'pointer',
  position: 'relative' as const
};

// Mock data - User mention data
export const mockMentionUsers: MentionUser[] = [
  {
    name: 'John Doe',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john_doe'
  },
  {
    name: 'Jane Smith',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane_smith'
  },
  {
    name: 'Mike Wilson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike_wilson'
  },
  {
    name: 'admin test',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
  },
  {
    name: 'support',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=support'
  },
  {
    name: 'Product Manager',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=product'
  },
  {
    name: 'UI Designer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=designer'
  },
  {
    name: 'Senior Developer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer'
  }
];

// Create custom Mentions component
const CustomMentions = connect(
  Mentions,
  mapProps({ readOnly: 'readOnly' })
);

// Utility functions
const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const createTooltip = (user: MentionUser): HTMLElement => {
  const tooltip = document.createElement('div');
  tooltip.className = 'mention-tooltip';

  const content = document.createElement('div');
  content.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const img = document.createElement('img');
  img.src = user.avatar;
  img.alt = user.name;
  img.style.cssText = 'width: 24px; height: 24px; border-radius: 50%;';

  const span = document.createElement('span');
  span.textContent = user.name;
  span.style.cssText = 'font-weight: 500; color: #262626;';

  content.appendChild(img);
  content.appendChild(span);
  tooltip.appendChild(content);

  // Apply tooltip styles
  Object.assign(tooltip.style, {
    position: 'absolute',
    zIndex: '9999',
    background: 'white',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    padding: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    minWidth: '120px',
    top: '-50px',
    left: '0',
    pointerEvents: 'none'
  });

  return tooltip;
};


// Main component
export const MentionsWithDefaults: React.FC<MentionsWithDefaultsProps> = (props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(props.value || '');

  // Listen for external value changes
  React.useEffect(() => {
    setValue(props.value || '');
  }, [props.value]);

  // Event handlers with useCallback for performance
  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback((e: any) => {
    setIsEditing(false);
    if (props.onBlur) {
      props.onBlur(e);
    }
  }, [props.onBlur]);

  const handleChange = useCallback((val: string) => {
    setValue(val);
    if (props.onChange) {
      props.onChange(val);
    }
  }, [props.onChange]);

  // Memoized options for Mentions component
  const transformedOptions = useMemo(() =>
    mockMentionUsers.map(user => ({
      value: user.name,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <Avatar
            src={user.avatar}
            size={20}
            alt={user.name}
          />
          <span>{user.name}</span>
        </div>
      ),
      avatar: user.avatar,
      name: user.name
    })), []
  );

  // Create highlighted text for display mode - optimized version
  const createHighlightedText = useCallback((text: string): string => {
    if (!text) return '';

    let highlightedText = text;

    mockMentionUsers.forEach((user, index) => {
      const userName = escapeRegex(user.name);
      const regex = new RegExp(`@(${userName})(?=\\s|$|[^\\w])`, 'g');

      const styleString = Object.entries(MENTION_SPAN_STYLES)
        .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
        .join('; ');

      const userHtml = `<span 
        style="${styleString}" 
        class="mention-user"
        data-user-index="${index}"
        data-user-name="${user.name.replace(/"/g, '&quot;')}" 
        data-user-avatar="${user.avatar}"
      >@$1</span>`;

      highlightedText = highlightedText.replace(regex, userHtml);
    });

    return highlightedText;
  }, []);

  // State to track current tooltip
  const currentTooltipRef = useRef<{ element: HTMLElement; userIndex: number } | null>(null);

  // Event delegation for mention hover - optimized with state tracking
  const handleDisplayMouseMove = useCallback((e: React.MouseEvent) => {
    const elementFromPoint = document.elementFromPoint(e.clientX, e.clientY);

    if (elementFromPoint && elementFromPoint.classList.contains('mention-user')) {
      const userIndex = parseInt((elementFromPoint as HTMLElement).getAttribute('data-user-index') || '0');

      // Check if we're already showing tooltip for this element
      if (currentTooltipRef.current &&
          currentTooltipRef.current.element === elementFromPoint &&
          currentTooltipRef.current.userIndex === userIndex) {
        return; // Already showing tooltip for this element
      }

      // Remove any existing tooltip first
      const container = e.currentTarget as HTMLElement;
      const existingTooltips = container.querySelectorAll('.mention-tooltip');
      existingTooltips.forEach(tooltip => tooltip.remove());

      const user = mockMentionUsers[userIndex];
      if (user) {
        // Create tooltip and add it to the mention element
        const tooltip = createTooltip(user);
        (elementFromPoint as HTMLElement).style.position = 'relative';
        elementFromPoint.appendChild(tooltip);

        // Update ref
        currentTooltipRef.current = {
          element: elementFromPoint as HTMLElement,
          userIndex
        };
      }
    } else {
      // Mouse is not over any mention element, remove all tooltips
      if (currentTooltipRef.current) {
        const container = e.currentTarget as HTMLElement;
        const tooltips = container.querySelectorAll('.mention-tooltip');
        tooltips.forEach(tooltip => tooltip.remove());
        currentTooltipRef.current = null;
      }
    }
  }, []);

  const handleDisplayMouseLeave = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;

    // Remove all tooltips when leaving the container
    const tooltips = target.querySelectorAll('.mention-tooltip');
    tooltips.forEach(tooltip => tooltip.remove());

    // Clear ref
    currentTooltipRef.current = null;
  }, []);

  // Filter function for mentions
  const filterOption = useCallback((input: string, option: any) => {
    return option?.name?.toLowerCase().includes(input.toLowerCase()) || false;
  }, []);

  // Display styles
  const displayStyles = useMemo(() => ({
    padding: '6px 11px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px',
    lineHeight: '22px',
    cursor: 'text',
    whiteSpace: 'pre-wrap' as const,
    wordWrap: 'break-word' as const,
    backgroundColor: '#fff',
    boxSizing: 'border-box' as const,
    resize: 'none' as const,
    transition: 'none',
    ...props.style
  }), [props.style]);

  // If not in editing state and has content, display highlighted version
  if (!isEditing && value) {
    return (
      <>
        <div
          onClick={handleClick}
          onMouseMove={handleDisplayMouseMove}
          onMouseLeave={handleDisplayMouseLeave}
          style={displayStyles}
          dangerouslySetInnerHTML={{
            __html: createHighlightedText(value)
          }}
        />
        <style jsx>{`
          .mention-user:hover {
            background-color: rgba(24, 144, 255, 0.2) !important;
            transition: background-color 0.2s ease-in-out;
          }
        `}</style>
      </>
    );
  }

  // Editing state, display normal Mentions component
  return (
    <CustomMentions
      {...props}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      options={transformedOptions}
      placeholder="Type @ to mention users..."
      autoSize={{ minRows: 3, maxRows: 6 }}
      autoFocus={isEditing}
      filterOption={filterOption}
    />
  );
};
