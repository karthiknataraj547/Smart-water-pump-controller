#pragma once
#ifndef _STDDEF_H_STUB
#define _STDDEF_H_STUB

#ifndef NULL
#ifdef __cplusplus
#define NULL nullptr
#else
#define NULL ((void*)0)
#endif
#endif

typedef __SIZE_TYPE__ size_t;
typedef __PTRDIFF_TYPE__ ptrdiff_t;

#define offsetof(type, member) __builtin_offsetof(type, member)

#endif // _STDDEF_H_STUB
