/**
 * Template Manager Service
 * Handles creation, storage, and application of page templates
 */

import { localStorageManager } from './local-storage';
import type { Note } from '$lib/types';

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'builtin' | 'custom';
  content: string; // Yjs document as base64
  created: Date;
  tags: string[];
}

export interface BlockTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string;
  category: string;
}

class TemplateManagerService {
  private readonly TEMPLATES_STORE = 'page-templates';
  private readonly BLOCK_TEMPLATES_STORE = 'block-templates';

  /**
   * Get all built-in page templates
   */
  getBuiltInTemplates(): PageTemplate[] {
    return [
      {
        id: 'blank',
        name: 'Blank Page',
        description: 'Start with an empty page',
        icon: '📄',
        category: 'builtin',
        content: '',
        created: new Date(),
        tags: ['basic']
      },
      {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Template for meeting notes with agenda and action items',
        icon: '📝',
        category: 'builtin',
        content: this.getMeetingNotesContent(),
        created: new Date(),
        tags: ['work', 'productivity']
      },
      {
        id: 'daily-journal',
        name: 'Daily Journal',
        description: 'Daily reflection and planning template',
        icon: '📔',
        category: 'builtin',
        content: this.getDailyJournalContent(),
        created: new Date(),
        tags: ['personal', 'journal']
      },
      {
        id: 'project-plan',
        name: 'Project Plan',
        description: 'Comprehensive project planning template',
        icon: '📊',
        category: 'builtin',
        content: this.getProjectPlanContent(),
        created: new Date(),
        tags: ['work', 'planning']
      },
      {
        id: 'task-list',
        name: 'Task List',
        description: 'Simple task tracking template',
        icon: '✅',
        category: 'builtin',
        content: this.getTaskListContent(),
        created: new Date(),
        tags: ['productivity', 'tasks']
      },
      {
        id: 'reading-notes',
        name: 'Reading Notes',
        description: 'Template for book or article notes',
        icon: '📚',
        category: 'builtin',
        content: this.getReadingNotesContent(),
        created: new Date(),
        tags: ['learning', 'notes']
      },
      {
        id: 'brainstorm',
        name: 'Brainstorming',
        description: 'Free-form brainstorming template',
        icon: '💡',
        category: 'builtin',
        content: this.getBrainstormContent(),
        created: new Date(),
        tags: ['creativity', 'ideas']
      }
    ];
  }

  /**
   * Get all custom templates
   */
  async getCustomTemplates(): Promise<PageTemplate[]> {
    try {
      if (typeof window === 'undefined') return [];
      const stored = localStorage.getItem(this.TEMPLATES_STORE);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      return [];
    }
  }

  /**
   * Get all templates (built-in + custom)
   */
  async getAllTemplates(): Promise<PageTemplate[]> {
    const builtIn = this.getBuiltInTemplates();
    const custom = await this.getCustomTemplates();
    return [...builtIn, ...custom];
  }

  /**
   * Save a note as a template
   */
  async saveAsTemplate(
    note: Note,
    name: string,
    description: string,
    icon: string,
    tags: string[] = []
  ): Promise<PageTemplate> {
    const template: PageTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description,
      icon,
      category: 'custom',
      content: note.content.toString(), // Convert Yjs doc to string
      created: new Date(),
      tags
    };

    const templates = await this.getCustomTemplates();
    templates.push(template);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TEMPLATES_STORE, JSON.stringify(templates));
    }

    return template;
  }

  /**
   * Delete a custom template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const templates = await this.getCustomTemplates();
    const filtered = templates.filter((t) => t.id !== templateId);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TEMPLATES_STORE, JSON.stringify(filtered));
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<PageTemplate | null> {
    const all = await this.getAllTemplates();
    return all.find((t) => t.id === templateId) || null;
  }

  /**
   * Get built-in block templates
   */
  getBuiltInBlockTemplates(): BlockTemplate[] {
    return [
      {
        id: 'callout-info',
        name: 'Info Callout',
        description: 'Informational callout box',
        icon: 'ℹ️',
        category: 'callouts',
        content: '> ℹ️ **Info**: Add your information here'
      },
      {
        id: 'callout-warning',
        name: 'Warning Callout',
        description: 'Warning callout box',
        icon: '⚠️',
        category: 'callouts',
        content: '> ⚠️ **Warning**: Add your warning here'
      },
      {
        id: 'callout-success',
        name: 'Success Callout',
        description: 'Success callout box',
        icon: '✅',
        category: 'callouts',
        content: '> ✅ **Success**: Add your success message here'
      },
      {
        id: 'table-simple',
        name: 'Simple Table',
        description: '3x3 table',
        icon: '⊞',
        category: 'tables',
        content: '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |'
      },
      {
        id: 'code-snippet',
        name: 'Code Snippet',
        description: 'Code block with syntax highlighting',
        icon: '</>',
        category: 'code',
        content: '```javascript\n// Your code here\nconsole.log("Hello, World!");\n```'
      }
    ];
  }

  // Template content generators
  private getMeetingNotesContent(): string {
    return `# Meeting Notes

**Date:** ${new Date().toLocaleDateString()}
**Attendees:** 

## Agenda
1. 
2. 
3. 

## Discussion Notes


## Action Items
- [ ] 
- [ ] 
- [ ] 

## Next Steps

`;
  }

  private getDailyJournalContent(): string {
    return `# Daily Journal - ${new Date().toLocaleDateString()}

## Morning Reflection
What am I grateful for today?


## Goals for Today
- [ ] 
- [ ] 
- [ ] 

## Notes


## Evening Reflection
What went well today?


What could I improve?

`;
  }

  private getProjectPlanContent(): string {
    return `# Project Plan

## Overview
**Project Name:** 
**Start Date:** 
**End Date:** 
**Status:** 🟡 Planning

## Objectives


## Milestones
- [ ] Milestone 1
- [ ] Milestone 2
- [ ] Milestone 3

## Tasks
### Phase 1
- [ ] Task 1
- [ ] Task 2

### Phase 2
- [ ] Task 1
- [ ] Task 2

## Resources


## Risks & Mitigation

`;
  }

  private getTaskListContent(): string {
    return `# Tasks

## Today
- [ ] 
- [ ] 
- [ ] 

## This Week
- [ ] 
- [ ] 
- [ ] 

## Backlog
- [ ] 
- [ ] 

`;
  }

  private getReadingNotesContent(): string {
    return `# Reading Notes

**Title:** 
**Author:** 
**Date:** ${new Date().toLocaleDateString()}

## Summary


## Key Takeaways
- 
- 
- 

## Quotes


## My Thoughts


## Action Items
- [ ] 
- [ ] 

`;
  }

  private getBrainstormContent(): string {
    return `# Brainstorming Session

**Topic:** 
**Date:** ${new Date().toLocaleDateString()}

## Ideas
💡 
💡 
💡 

## Promising Directions


## Next Steps
- [ ] 
- [ ] 

`;
  }
}

// Export singleton instance
export const templateManager = new TemplateManagerService();
