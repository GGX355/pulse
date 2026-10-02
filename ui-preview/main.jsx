import React from 'react';
import { createRoot } from 'react-dom/client';
import { createHashHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../src/routeTree.gen';
import '../src/components/final-glass/styles.css';
const router = createRouter({ routeTree, history: createHashHistory(), defaultPendingMs: 0 });
createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
