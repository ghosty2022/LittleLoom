



import { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { useSafeUser } from './useSafeContexts';

export const useUser = () => {
  try {
    const context = useContext(UserContext);
    if (!context) {
      
      return useSafeUser();
    }
    return context;
  } catch {
    return useSafeUser();
  }
};

export default useUser;