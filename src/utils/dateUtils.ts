export const getAvailableTimes = (date: Date): string[] => {
  const times = [
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
  ];

  const now = new Date();
  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate.getTime() === today.getTime()) {
    const currentHour = now.getHours();
    return times.filter((time) => {
      const hour = parseInt(time.split(':')[0]);
      return hour > currentHour + 1;
    });
  }

  return times;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getTodayDate = (): string => {
  return formatDate(new Date());
};

export const getMaxDate = (): string => {
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);
  return formatDate(maxDate);
};
