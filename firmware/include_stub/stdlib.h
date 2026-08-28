#pragma once
#ifndef _STDLIB_H_STUB
#define _STDLIB_H_STUB

#include "stddef.h"

#ifdef __cplusplus
extern "C" {
#endif

void *malloc(size_t size);
void *calloc(size_t num, size_t size);
void *realloc(void *ptr, size_t size);
void free(void *ptr);
int atoi(const char *nptr);
long atol(const char *nptr);
double atof(const char *nptr);
int abs(int x);
long labs(long x);
int rand(void);
void srand(unsigned int seed);

#ifdef __cplusplus
}
#endif

#endif // _STDLIB_H_STUB
