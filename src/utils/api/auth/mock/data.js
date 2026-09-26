// @project
import { AuthRole } from '@/enum';

/***************************  DATA - USERS  ***************************/

// Demo profiles for the local-only mock auth provider. No passwords or tokens are
// stored here: the mock provider is disabled outside `vite dev` and issues a
// throwaway session id at login time.

const mockUsers = [
  {
    id: '1',
    email: 'super_admin@saasable.io',
    role: AuthRole.SUPER_ADMIN,
    contact: '123456789',
    dialcode: '+1',
    firstname: 'John',
    lastname: 'Charly'
  },
  {
    id: '2',
    email: 'admin@saasable.io',
    role: AuthRole.ADMIN,
    contact: '123456789',
    dialcode: '+91',
    firstname: 'Mark',
    lastname: 'Davidson'
  },
  {
    id: '3',
    email: 'user@saasable.io',
    role: AuthRole.USER,
    contact: '123456789',
    dialcode: '+91',
    firstname: 'Bob',
    lastname: 'Dylan'
  }
];

export default mockUsers;
